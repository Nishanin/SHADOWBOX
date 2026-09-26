#!/usr/bin/env bash
# =============================================================================
# verify.sh -- SHADOWBOX Post-Fix Verification Script
# =============================================================================
# Builds the SHADOWBOX Docker image and verifies that after the Phase 4 fix
# all tests pass in the UTC environment.
#
# This is DISTINCT from reproduce.sh which verifies the PRE-FIX failure.
#
# Expected outcome (post-fix):
#   Container TZ = UTC
#   7 tests total: 7 pass, 0 fail
#   Test exit code: 0
#   Verification status: FIX VERIFIED
#
# Usage (from repo root):
#   bash shadowbox/verify.sh
# =============================================================================

set -euo pipefail

IMAGE_NAME="shadowbox-demo"
IMAGE_TAG="latest"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_PASS=7
EXPECTED_FAIL=0
EXPECTED_TOTAL=7

log()  { echo "[SHADOWBOX] $*"; }
pass() { echo "[PASS] $*"; }
fail() { echo "[FAIL] $*"; }
sep()  { printf '[SHADOWBOX] ============================================================\n'; }

sep
log "SHADOWBOX Post-Fix Verification"
log "Project root : ${REPO_ROOT}"
log "Image        : ${IMAGE_NAME}:${IMAGE_TAG}"
sep

log "Checking Docker availability..."
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH."
  exit 2
fi
log "Docker found: $(docker --version)"
sep

log "Building Docker image ${IMAGE_NAME}:${IMAGE_TAG} ..."
echo ""
docker build \
  --file "${REPO_ROOT}/shadowbox/Dockerfile" \
  --tag  "${IMAGE_NAME}:${IMAGE_TAG}" \
  "${REPO_ROOT}"
echo ""
log "Build complete."
sep

log "Running SHADOWBOX container (post-fix verification)..."
log "Environment  : TZ=UTC (set inside Dockerfile)"
echo ""

TEST_OUTPUT=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" 2>&1) || TEST_EXIT=$?
TEST_EXIT=${TEST_EXIT:-0}

echo "${TEST_OUTPUT}"
echo ""

ACTUAL_PASS=$(echo "${TEST_OUTPUT}"  | grep -oP 'pass \K[0-9]+'  | tail -1 || echo "?")
ACTUAL_FAIL=$(echo "${TEST_OUTPUT}"  | grep -oP 'fail \K[0-9]+'  | tail -1 || echo "?")
ACTUAL_TOTAL=$(echo "${TEST_OUTPUT}" | grep -oP 'tests \K[0-9]+' | tail -1 || echo "?")

sep
log "VERIFICATION RESULTS"
sep
log "Environment    : TZ=UTC"
log "Tests total    : ${ACTUAL_TOTAL}  (expected: ${EXPECTED_TOTAL})"
log "Tests passed   : ${ACTUAL_PASS}  (expected: ${EXPECTED_PASS})"
log "Tests failed   : ${ACTUAL_FAIL}  (expected: ${EXPECTED_FAIL})"
log "Test exit code : ${TEST_EXIT}    (expected: 0)"
sep

SCRIPT_EXIT=2
if [[ "${ACTUAL_FAIL}" == "${EXPECTED_FAIL}" && \
      "${ACTUAL_PASS}" == "${EXPECTED_PASS}" && \
      "${ACTUAL_TOTAL}" == "${EXPECTED_TOTAL}" && \
      "${TEST_EXIT}"    == "0" ]]; then
  pass "[VERIFIED] FIX VERIFIED"
  pass "All ${EXPECTED_TOTAL} tests pass in the UTC SHADOWBOX environment."
  SCRIPT_EXIT=0
else
  fail "[UNVERIFIED] Fix verification failed - unexpected result."
  fail "Review the output above."
  SCRIPT_EXIT=2
fi

echo ""
sep
log "To compare against the pre-fix failure, run: bash shadowbox/reproduce.sh"
log "reproduce.sh expects the original 5/2/3 failure pattern (pre-fix code only)."
sep

exit "${SCRIPT_EXIT}"
