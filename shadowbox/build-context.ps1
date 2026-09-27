# =============================================================================
# build-context.ps1 -- Ephemeral Context Builder (Windows PowerShell)
# =============================================================================
# Constructs a clean, isolated Docker build context from an approved
# git snapshot using git archive. Never touches working tree demo-app/.
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Variant,

    [Parameter(Mandatory = $false)]
    [string]$VariantsConfigFile,

    [Parameter(Mandatory = $false)]
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $VariantsConfigFile) {
    $VariantsConfigFile = Join-Path $PSScriptRoot "variants.json"
}

function Log-Ctx { param([string]$msg) Write-Host "[SHADOWBOX-BUILD-CONTEXT] $msg" }
function Err-Ctx { param([string]$msg) Write-Host "[SHADOWBOX-BUILD-CONTEXT][ERROR] $msg" -ForegroundColor Red }

# 1. Validate configuration file
if (-not (Test-Path -LiteralPath $VariantsConfigFile)) {
    Err-Ctx "Variants configuration not found at: $VariantsConfigFile"
    throw "Variants configuration not found: $VariantsConfigFile"
}

$variantsConfig = Get-Content -LiteralPath $VariantsConfigFile -Raw | ConvertFrom-Json
$allowedVariants = @($variantsConfig.allowedVariants)

# 2. Validate requested variant against allowlist
if ($Variant -notin $allowedVariants) {
    $allowedListStr = ($allowedVariants -join ", ")
    Err-Ctx "Variant '$Variant' is not allowed. Strictly allowed variants: [$allowedListStr]"
    throw "INVALID_VARIANT: '$Variant' is not allowed."
}

$variantDef = $variantsConfig.variants.$Variant
if (-not $variantDef -or -not $variantDef.commit) {
    Err-Ctx "No commit configuration found for variant: $Variant"
    throw "INVALID_VARIANT_CONFIG: Missing commit for '$Variant'"
}

$commit = [string]$variantDef.commit
$sourcePath = if ($variantsConfig.sourcePath) { [string]$variantsConfig.sourcePath } else { "demo-app" }

# 3. Verify commit exists in repository
$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$gitRevCheck = git -C "$repoRoot" rev-parse --verify "${commit}^{commit}" 2>&1
if ($LASTEXITCODE -ne 0) {
    Err-Ctx "Commit $commit does not exist in local Git object store."
    throw "MISSING_COMMIT: Commit $commit not found in repository."
}

# 4. Create ephemeral temporary context directory
$tempBase = [System.IO.Path]::GetTempPath()
$runGuid = [System.Guid]::NewGuid().ToString("N")
$contextDir = Join-Path $tempBase ("shadowbox-ctx-" + $Variant + "-" + $runGuid)
$tarPath = Join-Path $tempBase ("shadowbox-tar-" + $runGuid + ".tar")
$extractStaging = Join-Path $tempBase ("shadowbox-stage-" + $runGuid)

try {
    New-Item -ItemType Directory -Path $contextDir -Force | Out-Null
    New-Item -ItemType Directory -Path $extractStaging -Force | Out-Null

    # 5. Extract sourcePath from specified commit via git archive
    git -C "$repoRoot" archive --format=tar --output="$tarPath" $commit $sourcePath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $tarPath)) {
        throw "GIT_ARCHIVE_ERROR: Failed to archive $sourcePath from commit $commit"
    }

    # 6. Extract tar archive into staging directory
    tar -xf "$tarPath" -C "$extractStaging"
    if ($LASTEXITCODE -ne 0) {
        throw "ARCHIVE_EXTRACTION_ERROR: Failed to extract tar archive"
    }

    $stagedSource = Join-Path $extractStaging $sourcePath
    if (-not (Test-Path -LiteralPath $stagedSource)) {
        throw "INVALID_ARCHIVE_CONTENT: '$sourcePath' not found inside extracted archive"
    }

    # 7. Move application files into expected context structure:
    #    package.json, package-lock.json, src/, tests/
    Get-ChildItem -LiteralPath $stagedSource | ForEach-Object {
        Move-Item -LiteralPath $_.FullName -Destination $contextDir -Force
    }

    # 8. Copy shadowbox Dockerfile into build context
    $dockerfileSource = Join-Path $PSScriptRoot "Dockerfile"
    if (-not (Test-Path -LiteralPath $dockerfileSource)) {
        throw "DOCKERFILE_NOT_FOUND: Dockerfile missing at $dockerfileSource"
    }
    Copy-Item -LiteralPath $dockerfileSource -Destination (Join-Path $contextDir "Dockerfile") -Force

    # Verify context layout
    $requiredFiles = @("package.json", "src", "tests", "Dockerfile")
    foreach ($rf in $requiredFiles) {
        $p = Join-Path $contextDir $rf
        if (-not (Test-Path -LiteralPath $p)) {
            throw "INCOMPLETE_CONTEXT: Missing required build file $rf in context"
        }
    }

    $result = [PSCustomObject]@{
        Variant    = $Variant
        Commit     = $commit
        ContextDir = $contextDir
        Dockerfile = (Join-Path $contextDir "Dockerfile")
    }

    if ($Json) {
        $result | ConvertTo-Json -Compress
    } else {
        return $result
    }

} catch {
    # Guarantee immediate cleanup on context build failure
    if (Test-Path -LiteralPath $contextDir) {
        Remove-Item -LiteralPath $contextDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
} finally {
    # Staging dir and tar archive are always ephemeral and removed immediately
    if (Test-Path -LiteralPath $tarPath) {
        Remove-Item -LiteralPath $tarPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $extractStaging) {
        Remove-Item -LiteralPath $extractStaging -Recurse -Force -ErrorAction SilentlyContinue
    }
}
