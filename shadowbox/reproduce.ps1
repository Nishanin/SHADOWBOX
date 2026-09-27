# =============================================================================
# reproduce.ps1 -- SHADOWBOX Reproduction Runner (Windows PowerShell)
# =============================================================================
# Executes the approved 'reproduction' source variant in an isolated,
# ephemeral Docker container (node:20-alpine, non-root, TZ=UTC, network=none).
#
# Pinned Commit: 23fd96e4c992316437b7aada02f12f915112de23
# Expected Outcome: 5 tests (2 pass, 3 fail, test exit code 1) -> REPRODUCED
#
# Usage:
#   .\shadowbox\reproduce.ps1 [-Format <text|json>]
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("text", "json")]
    [string]$Format = "text"
)

$runnerScript = Join-Path $PSScriptRoot "runner.ps1"
& "$runnerScript" -Variant "reproduction" -Format $Format
exit $LASTEXITCODE
