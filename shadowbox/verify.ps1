# =============================================================================
# verify.ps1 -- SHADOWBOX Verification Runner (Windows PowerShell)
# =============================================================================
# Executes the approved 'verification' source variant in an isolated,
# ephemeral Docker container (node:20-alpine, non-root, TZ=UTC, network=none).
#
# Pinned Commit: 96b905b36325a2bb055f2eeba8fb0d1460dfc5c7
# Expected Outcome: 7 tests (7 pass, 0 fail, test exit code 0) -> VERIFIED
#
# Usage:
#   .\shadowbox\verify.ps1 [-Format <text|json>]
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("text", "json")]
    [string]$Format = "text"
)

$runnerScript = Join-Path $PSScriptRoot "runner.ps1"
& "$runnerScript" -Variant "verification" -Format $Format
exit $LASTEXITCODE
