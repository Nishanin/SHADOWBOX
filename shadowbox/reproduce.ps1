# =============================================================================
# reproduce.ps1 -- SHADOWBOX Reproduction Script (Windows PowerShell)
# =============================================================================
# Builds the SHADOWBOX Docker image and runs the demo-app test suite inside it.
#
# Expected outcome:
#   Container TZ = UTC | 5 tests: 2 pass, 3 fail | Reproduction: FAILURE REPRODUCED
#
# Usage (from repo root):
#   .\shadowbox\reproduce.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$ImageName     = "shadowbox-demo"
$ImageTag      = "latest"
$RepoRoot      = (Resolve-Path "$PSScriptRoot\..").Path
$ExpectedPass  = 2
$ExpectedFail  = 3
$ExpectedTotal = 5

function Log  { param($msg) Write-Host "[SHADOWBOX] $msg" }
function Sep  { Write-Host "[SHADOWBOX] ============================================================" }
function Ok   { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Err  { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Info { param($msg) Write-Host "[INFO] $msg" }

Sep
Log "SHADOWBOX Reproduction Environment"
Log "Project root : $RepoRoot"
Log "Image        : ${ImageName}:${ImageTag}"
Sep

# ---------------------------------------------------------------------------
# 1. Verify Docker
# ---------------------------------------------------------------------------
Log "Checking Docker availability..."
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Err "Docker is not installed or not in PATH."
    Err "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 2
}
Log "Docker found: $(docker --version)"
Sep

# ---------------------------------------------------------------------------
# 2. Build image
# ---------------------------------------------------------------------------
Log "Building Docker image ${ImageName}:${ImageTag} ..."
Log "Build context : $RepoRoot"
Log "Dockerfile    : $RepoRoot\shadowbox\Dockerfile"
Write-Host ""

docker build `
    --file "$RepoRoot\shadowbox\Dockerfile" `
    --tag  "${ImageName}:${ImageTag}" `
    "$RepoRoot"

if ($LASTEXITCODE -ne 0) {
    Err "Docker build failed. Review output above."
    exit 2
}
Log "Build complete."
Sep

# ---------------------------------------------------------------------------
# 3. Run container and capture output
# ---------------------------------------------------------------------------
Log "Running SHADOWBOX container..."
Log "Environment  : TZ=UTC (set inside Dockerfile)"
Write-Host ""

# Run container; capture stdout+stderr together.
# Docker exits non-zero because tests fail -- that is expected.
# We save $LASTEXITCODE immediately after the call.
$TestOutput = docker run --rm "${ImageName}:${ImageTag}" 2>&1
$TestExit   = $LASTEXITCODE

Write-Host ($TestOutput -join "`n")
Write-Host ""

# ---------------------------------------------------------------------------
# 4. Parse test counts from output
# ---------------------------------------------------------------------------
$ActualPass  = ($TestOutput | Select-String 'pass (\d+)'  | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1)
$ActualFail  = ($TestOutput | Select-String 'fail (\d+)'  | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1)
$ActualTotal = ($TestOutput | Select-String 'tests (\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1)

Sep
Log "RESULTS SUMMARY"
Sep
Log "Environment    : TZ=UTC"
Log "Tests total    : $ActualTotal  (expected: $ExpectedTotal)"
Log "Tests passed   : $ActualPass  (expected: $ExpectedPass)"
Log "Tests failed   : $ActualFail  (expected: $ExpectedFail)"
Log "Test exit code : $TestExit    (expected: 1)"
Sep

# ---------------------------------------------------------------------------
# 5. Reproduction status
# ---------------------------------------------------------------------------
# A non-zero test exit code is EXPECTED -- it means the bug is active.
# The reproduction is SUCCESSFUL when the exact 5/2/3 pattern is observed.
# ---------------------------------------------------------------------------
$ScriptExit = 2

if (($ActualFail -eq $ExpectedFail) -and
    ($ActualPass -eq $ExpectedPass) -and
    ($ActualTotal -eq $ExpectedTotal)) {

    Ok "[REPRODUCED] FAILURE REPRODUCED"
    Ok "The known timezone bug has been confirmed in the SHADOWBOX environment."
    $ScriptExit = 0

} else {
    Err "[UNEXPECTED] Result did not match expected failure pattern."
    Err "Review the output above and compare with shadowbox/environment.json."
    $ScriptExit = 2
}

Write-Host ""
Sep
Info "Test exit code $TestExit is the raw Docker/test-runner result."
Info "A non-zero test exit code is EXPECTED when the bug is reproduced."
Info "The [REPRODUCED] / [UNEXPECTED] status above is the SHADOWBOX signal."
Sep

exit $ScriptExit
