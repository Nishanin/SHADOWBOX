# =============================================================================
# verify.ps1 -- SHADOWBOX Post-Fix Verification Script (Windows PowerShell)
# =============================================================================
# Builds the SHADOWBOX Docker image and verifies that after the Phase 4 fix
# all tests pass in the UTC environment.
#
# This is DISTINCT from reproduce.ps1 which verifies the PRE-FIX failure.
#
# Expected outcome (post-fix):
#   Container TZ = UTC | 7 tests: 7 pass, 0 fail | Verification: FIX VERIFIED
#
# Usage (from repo root):
#   .\shadowbox\verify.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$ImageName     = "shadowbox-demo"
$ImageTag      = "latest"
$RepoRoot      = (Resolve-Path "$PSScriptRoot\..").Path
$ExpectedPass  = 7
$ExpectedFail  = 0
$ExpectedTotal = 7

function Log  { param($msg) Write-Host "[SHADOWBOX] $msg" }
function Sep  { Write-Host "[SHADOWBOX] ============================================================" }
function Ok   { param($msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Err  { param($msg) Write-Host "[FAIL] $msg" -ForegroundColor Red }
function Info { param($msg) Write-Host "[INFO] $msg" }

Sep
Log "SHADOWBOX Post-Fix Verification"
Log "Project root : $RepoRoot"
Log "Image        : ${ImageName}:${ImageTag}"
Sep

Log "Checking Docker availability..."
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Err "Docker is not installed or not in PATH."
    exit 2
}
Log "Docker found: $(docker --version)"
Sep

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

Log "Running SHADOWBOX container (post-fix verification)..."
Log "Environment  : TZ=UTC (set inside Dockerfile)"
Write-Host ""

$TestOutput = docker run --rm "${ImageName}:${ImageTag}" 2>&1
$TestExit   = $LASTEXITCODE

Write-Host ($TestOutput -join "`n")
Write-Host ""

$ActualPass  = ($TestOutput | Select-String 'pass (\d+)'  | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1)
$ActualFail  = ($TestOutput | Select-String 'fail (\d+)'  | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1)
$ActualTotal = ($TestOutput | Select-String 'tests (\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1)

Sep
Log "VERIFICATION RESULTS"
Sep
Log "Environment    : TZ=UTC"
Log "Tests total    : $ActualTotal  (expected: $ExpectedTotal)"
Log "Tests passed   : $ActualPass  (expected: $ExpectedPass)"
Log "Tests failed   : $ActualFail  (expected: $ExpectedFail)"
Log "Test exit code : $TestExit    (expected: 0)"
Sep

$ScriptExit = 2

if (($ActualFail -eq $ExpectedFail) -and
    ($ActualPass -eq $ExpectedPass) -and
    ($ActualTotal -eq $ExpectedTotal) -and
    ($TestExit -eq 0)) {

    Ok "[VERIFIED] FIX VERIFIED"
    Ok "All $ExpectedTotal tests pass in the UTC SHADOWBOX environment."
    $ScriptExit = 0

} else {
    Err "[UNVERIFIED] Fix verification failed - unexpected result."
    Err "Review the output above."
    $ScriptExit = 2
}

Write-Host ""
Sep
Info "To compare against the pre-fix failure, run: .\shadowbox\reproduce.ps1"
Info "reproduce.ps1 expects the original 5/2/3 failure pattern (pre-fix code only)."
Sep

exit $ScriptExit
