#!/usr/bin/env bash
# =============================================================================
# verify.sh -- SHADOWBOX Verification Runner (Bash / Linux / macOS)
# =============================================================================
# Executes the approved 'verification' source variant in an isolated,
# ephemeral Docker container (node:20-alpine, non-root, TZ=UTC, network=none).
#
# Pinned Commit: 96b905b36325a2bb055f2eeba8fb0d1460dfc5c7
# Expected Outcome: 7 tests (7 pass, 0 fail, test exit code 0) -> VERIFIED
#
# Usage:
#   bash shadowbox/verify.sh [--json]
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/runner.sh" verification "$@"
