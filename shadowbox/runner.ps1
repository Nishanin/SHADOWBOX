# =============================================================================
# runner.ps1 -- SHADOWBOX Source-Variant Execution Engine (PowerShell)
# =============================================================================
# Orchestrates isolated execution for approved variants (reproduction, verification)
# using ephemeral contexts extracted via git archive.
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Variant,

    [Parameter(Mandatory = $false)]
    [ValidateSet("text", "json")]
    [string]$Format = "text",

    [Parameter(Mandatory = $false)]
    [string]$VariantsConfigFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $VariantsConfigFile) {
    $VariantsConfigFile = Join-Path $PSScriptRoot "variants.json"
}

function Log-Sb  { param([string]$msg) if ($Format -eq "text") { Write-Host "[SHADOWBOX] $msg" } }
function Sep-Sb  { if ($Format -eq "text") { Write-Host "[SHADOWBOX] ============================================================" } }
function Ok-Sb   { param([string]$msg) if ($Format -eq "text") { Write-Host "[PASS] $msg" -ForegroundColor Green } }
function Warn-Sb { param([string]$msg) if ($Format -eq "text") { Write-Host "[WARN] $msg" -ForegroundColor Yellow } }
function Err-Sb  { param([string]$msg) if ($Format -eq "text") { Write-Host "[FAIL] $msg" -ForegroundColor Red } }
function Info-Sb { param([string]$msg) if ($Format -eq "text") { Write-Host "[INFO] $msg" -ForegroundColor Cyan } }

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path

$outputContract = [ordered]@{
    variant       = $Variant
    sourceCommit  = $null
    imageTag      = $null
    totalTests    = $null
    passedTests   = $null
    failedTests   = $null
    testExitCode  = $null
    status        = "INFRASTRUCTURE_ERROR"
    stdout        = ""
    stderr        = ""
    duration      = "0s"
    durationMs    = 0
    errorCategory = $null
}

$exitCode = 3
$contextDir = $null
$imageTag = $null

try {
    # -------------------------------------------------------------------------
    # 1. Validate Configuration and Variant Allowlist
    # -------------------------------------------------------------------------
    if (-not (Test-Path -LiteralPath $VariantsConfigFile)) {
        $outputContract.errorCategory = "CONFIG_NOT_FOUND"
        $outputContract.stderr = "Variants configuration file not found at: $VariantsConfigFile"
        $exitCode = 3
        throw $outputContract.stderr
    }

    $variantsConfig = Get-Content -LiteralPath $VariantsConfigFile -Raw | ConvertFrom-Json
    $allowedVariants = @($variantsConfig.allowedVariants)

    if ($Variant -notin $allowedVariants) {
        $outputContract.errorCategory = "INVALID_VARIANT"
        $allowedListStr = ($allowedVariants -join ", ")
        $outputContract.stderr = "Variant '$Variant' is not allowed. Strictly allowed variants: [$allowedListStr]"
        $exitCode = 3
        throw $outputContract.stderr
    }

    $variantDef = $variantsConfig.variants.$Variant
    $outputContract.sourceCommit = [string]$variantDef.commit
    $expected = $variantDef.expected

    # -------------------------------------------------------------------------
    # 2. Check Docker Daemon Availability
    # -------------------------------------------------------------------------
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $dockerCmd) {
        $outputContract.errorCategory = "DOCKER_NOT_INSTALLED"
        $outputContract.stderr = "Docker CLI executable not found in PATH."
        $exitCode = 3
        throw $outputContract.stderr
    }

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $dockerPing = docker info --format "{{.ServerVersion}}" 2>&1
    $dockerPingExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($dockerPingExit -ne 0) {
        $outputContract.errorCategory = "DOCKER_DAEMON_UNAVAILABLE"
        $outputContract.stderr = "Docker daemon is not running or not responding: $($dockerPing -join ' ')"
        $exitCode = 3
        throw $outputContract.stderr
    }

    # -------------------------------------------------------------------------
    # 3. Check Commit Existence in Local Git Store
    # -------------------------------------------------------------------------
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $commitCheck = git -C "$repoRoot" rev-parse --verify "$($outputContract.sourceCommit)^{commit}" 2>&1
    $commitCheckExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($commitCheckExit -ne 0) {
        $outputContract.errorCategory = "MISSING_COMMIT"
        $outputContract.stderr = "Commit $($outputContract.sourceCommit) not found in local Git object store."
        $exitCode = 3
        throw $outputContract.stderr
    }

    Sep-Sb
    Log-Sb "SHADOWBOX Variant Execution"
    Log-Sb "Variant       : $Variant"
    Log-Sb "Source commit : $($outputContract.sourceCommit)"
    Log-Sb "Isolation     : node:20-alpine | non-root (node) | TZ=UTC | network=none"
    Sep-Sb

    # -------------------------------------------------------------------------
    # 4. Build Ephemeral Context via git archive
    # -------------------------------------------------------------------------
    Log-Sb "Building ephemeral context from git snapshot..."
    $buildContextScript = Join-Path $PSScriptRoot "build-context.ps1"
    $ctxResult = & "$buildContextScript" -Variant $Variant -VariantsConfigFile $VariantsConfigFile
    $contextDir = $ctxResult.ContextDir

    # Generate unique image tag
    $runId = [System.Guid]::NewGuid().ToString("N").Substring(0, 12)
    $imageTag = "shadowbox-${Variant}:${runId}"
    $outputContract.imageTag = $imageTag

    Log-Sb "Ephemeral context created at: $contextDir"
    Log-Sb "Unique image tag: $imageTag"

    # -------------------------------------------------------------------------
    # 5. Build Hardened Docker Image
    # -------------------------------------------------------------------------
    Log-Sb "Building Docker image (isolated context)..."
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $buildOutput = docker build `
        --file "$contextDir\Dockerfile" `
        --tag "$imageTag" `
        "$contextDir" 2>&1
    $buildExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP

    if ($buildExit -ne 0) {
        $outputContract.errorCategory = "BUILD_FAILED"
        $outputContract.stderr = ($buildOutput -join "`n")
        $exitCode = 3
        throw "Docker build failed: $($outputContract.stderr)"
    }
    Log-Sb "Docker image built successfully."

    # -------------------------------------------------------------------------
    # 6. Execute Container with Security Isolation
    # -------------------------------------------------------------------------
    Log-Sb "Running container with security hardening:"
    Log-Sb "  --rm"
    Log-Sb "  --network none"
    Log-Sb "  --memory 512m"
    Log-Sb "  --cpus 1.0"
    Write-Host ""

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $testOutput = docker run `
        --rm `
        --network none `
        --memory 512m `
        --cpus 1.0 `
        "$imageTag" 2>&1
    $testExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP

    $outputContract.testExitCode = $testExit
    $rawOutput = ($testOutput -join "`n")
    $outputContract.stdout = $rawOutput

    if ($Format -eq "text") {
        Write-Host $rawOutput
        Write-Host ""
    }

    # -------------------------------------------------------------------------
    # 7. Parse Test Results Robustly
    # -------------------------------------------------------------------------
    $totalMatch = [regex]::Matches($rawOutput, '#\s+tests\s+(\d+)')
    $passMatch  = [regex]::Matches($rawOutput, '#\s+pass\s+(\d+)')
    $failMatch  = [regex]::Matches($rawOutput, '#\s+fail\s+(\d+)')

    $hasParsedMetrics = ($totalMatch.Count -gt 0 -and $passMatch.Count -gt 0)

    if ($hasParsedMetrics) {
        $actualTotal = [int]$totalMatch[$totalMatch.Count - 1].Groups[1].Value
        $actualPass  = [int]$passMatch[$passMatch.Count - 1].Groups[1].Value
        $actualFail  = if ($failMatch.Count -gt 0) { [int]$failMatch[$failMatch.Count - 1].Groups[1].Value } else { 0 }

        $outputContract.totalTests  = $actualTotal
        $outputContract.passedTests = $actualPass
        $outputContract.failedTests = $actualFail

        Sep-Sb
        Log-Sb "EXECUTION METRICS"
        Sep-Sb
        Log-Sb "Tests total    : $actualTotal (expected: $($expected.totalTests))"
        Log-Sb "Tests passed   : $actualPass (expected: $($expected.passedTests))"
        Log-Sb "Tests failed   : $actualFail (expected: $($expected.failedTests))"
        Log-Sb "Test exit code : $testExit (expected: $($expected.testExitCode))"
        Sep-Sb

        # ---------------------------------------------------------------------
        # 8. Evaluate Outcome vs Variant Semantics
        # ---------------------------------------------------------------------
        $isReproduction = ($Variant -eq "reproduction")
        $isVerification = ($Variant -eq "verification")

        if ($isReproduction) {
            if ($actualTotal -eq [int]$expected.totalTests -and
                $actualPass  -eq [int]$expected.passedTests -and
                $actualFail  -eq [int]$expected.failedTests -and
                $testExit    -eq [int]$expected.testExitCode) {

                $outputContract.status = "REPRODUCED"
                $outputContract.errorCategory = $null
                $exitCode = 0
                Ok-Sb "[REPRODUCED] DEFECT CONFIRMED"
                Ok-Sb "Known timezone failure verified in Shadowbox runtime."
            } else {
                $outputContract.status = "UNEXPECTED_RESULT"
                $outputContract.errorCategory = "UNEXPECTED_TEST_METRICS"
                $exitCode = 2
                Warn-Sb "[UNEXPECTED_RESULT] Test counts did not match expected reproduction profile."
            }
        } elseif ($isVerification) {
            if ($actualTotal -eq [int]$expected.totalTests -and
                $actualPass  -eq [int]$expected.passedTests -and
                $actualFail  -eq [int]$expected.failedTests -and
                $testExit    -eq [int]$expected.testExitCode) {

                $outputContract.status = "VERIFIED"
                $outputContract.errorCategory = $null
                $exitCode = 0
                Ok-Sb "[VERIFIED] FIX CONFIRMED"
                Ok-Sb "All tests pass cleanly in isolated Shadowbox runtime."
            } else {
                $outputContract.status = "UNEXPECTED_RESULT"
                $outputContract.errorCategory = "UNEXPECTED_TEST_METRICS"
                $exitCode = 2
                Warn-Sb "[UNEXPECTED_RESULT] Verification did not match expected passing profile."
            }
        }
    } else {
        # Execution produced no valid test metrics (e.g. container crashed or script error)
        $outputContract.status = "INFRASTRUCTURE_ERROR"
        $outputContract.errorCategory = "OUTPUT_PARSE_ERROR"
        $outputContract.stderr = "Could not parse TAP test metrics from container execution."
        $exitCode = 3
        Err-Sb "[INFRASTRUCTURE_ERROR] Test metrics could not be parsed."
    }

} catch {
    if (-not $outputContract.errorCategory) {
        $outputContract.errorCategory = "INFRASTRUCTURE_ERROR"
    }
    if (-not $outputContract.stderr) {
        $outputContract.stderr = $_.Exception.Message
    }
    $outputContract.status = "INFRASTRUCTURE_ERROR"
    $exitCode = 3
    Err-Sb "Execution error: $($_.Exception.Message)"
} finally {
    # -------------------------------------------------------------------------
    # 9. Guaranteed Ephemeral Cleanup (finally semantics)
    # -------------------------------------------------------------------------
    if ($contextDir -and (Test-Path -LiteralPath $contextDir)) {
        Remove-Item -LiteralPath $contextDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($imageTag) {
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        docker rmi -f "$imageTag" 2>$null | Out-Null
        $ErrorActionPreference = $prevEAP
    }

    $sw.Stop()
    $outputContract.durationMs = [int]$sw.ElapsedMilliseconds
    $outputContract.duration = "$([Math]::Round($sw.Elapsed.TotalSeconds, 2))s"

    if ($Format -eq "json") {
        $outputContract | ConvertTo-Json -Depth 5
    } else {
        Sep-Sb
        Info-Sb "Status         : $($outputContract.status)"
        Info-Sb "Duration       : $($outputContract.duration)"
        if ($outputContract.errorCategory) {
            Info-Sb "Error Category : $($outputContract.errorCategory)"
        }
        Info-Sb "Runner Exit    : $exitCode"
        Sep-Sb
    }
}

exit $exitCode
