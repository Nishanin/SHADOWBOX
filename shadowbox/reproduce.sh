#!/usr/bin/env bash
# =============================================================================
# reproduce.sh -- SHADOWBOX Reproduction Runner (Bash / Linux / macOS)
# =============================================================================
# Executes the approved 'reproduction' source variant in an isolated,
# ephemeral Docker container (node:20-alpine, non-root, TZ=UTC, network=none).
#
# Pinned Commit: 23fd96e4c992316437b7aada02f12f915112de23
# Expected Outcome: 5 tests (2 pass, 3 fail, test exit code 1) -> REPRODUCED
#
# Usage:
#   bash shadowbox/reproduce.sh [--json]
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/runner.sh" reproduction "$@"
