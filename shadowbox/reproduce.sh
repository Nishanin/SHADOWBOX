#!/usr/bin/env bash
# =============================================================================
# reproduce.sh -- SHADOWBOX Reproduction Script
# =============================================================================
# Builds the SHADOWBOX Docker image and runs the demo-app test suite inside it.
#
# Expected outcome:
#   - Container TZ = UTC
#   - 5 tests total: 2 pass, 3 fail
#   - Test exit code: 1  (tests genuinely fail)
#   - Reproduction status: FAILURE REPRODUCED
#
# Usage:
#   cd <repo-root>
#   bash shadowbox/reproduce.sh
#
# The script returns exit code 0 when the EXPECTED failure is reproduced
# (i.e., exactly 3 tests fail), and exit code 2 when reproduction is
# inconclusive (unexpected result).
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
IMAGE_NAME="shadowbox-demo"
IMAGE_TAG="latest"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_PASS=2
EXPECTED_FAIL=3
EXPECTED_TOTAL=5

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[SHADOWBOX] $*"; }
pass() { echo "[PASS] $*"; }
fail() { echo "[FAIL] $*"; }
sep()  { printf '[SHADOWBOX] ============================================================\n'; }

sep
log "SHADOWBOX Reproduction Environment"
log "Project root : ${REPO_ROOT}"
log "Image        : ${IMAGE_NAME}:${IMAGE_TAG}"
sep

# ---------------------------------------------------------------------------
# 1. Verify Docker is available
# ---------------------------------------------------------------------------
log "Checking Docker availability..."
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not in PATH."
  fail "Install Docker Desktop (https://www.docker.com/products/docker-desktop/)"
  fail "then re-run this script from the repository root."
  exit 2
fi
log "Docker found: $(docker --version)"
sep

# ---------------------------------------------------------------------------
# 2. Build the SHADOWBOX image
# ---------------------------------------------------------------------------
log "Building Docker image ${IMAGE_NAME}:${IMAGE_TAG} ..."
log "Build context: ${REPO_ROOT}"
log "Dockerfile   : ${REPO_ROOT}/shadowbox/Dockerfile"
echo ""

docker build \
  --file "${REPO_ROOT}/shadowbox/Dockerfile" \
  --tag  "${IMAGE_NAME}:${IMAGE_TAG}" \
  "${REPO_ROOT}"

echo ""
log "Build complete."
sep

# ---------------------------------------------------------------------------
# 3. Run the reproduction container
# ---------------------------------------------------------------------------
log "Running SHADOWBOX container..."
log "Environment  : TZ=UTC (set inside Dockerfile)"
echo ""

# Capture container output AND preserve exit code
TEST_OUTPUT=$(docker run --rm "${IMAGE_NAME}:${IMAGE_TAG}" 2>&1) || TEST_EXIT=$?
TEST_EXIT=${TEST_EXIT:-0}

echo "${TEST_OUTPUT}"
echo ""

# ---------------------------------------------------------------------------
# 4. Parse test results from output
# ---------------------------------------------------------------------------
ACTUAL_PASS=$(echo "${TEST_OUTPUT}" | grep -oP 'pass \K[0-9]+' | tail -1 || echo "?")
ACTUAL_FAIL=$(echo "${TEST_OUTPUT}" | grep -oP 'fail \K[0-9]+' | tail -1 || echo "?")
ACTUAL_TOTAL=$(echo "${TEST_OUTPUT}" | grep -oP 'tests \K[0-9]+' | tail -1 || echo "?")

sep
log "RESULTS SUMMARY"
sep
log "Environment   : TZ=UTC"
log "Tests total   : ${ACTUAL_TOTAL}  (expected: ${EXPECTED_TOTAL})"
log "Tests passed  : ${ACTUAL_PASS}  (expected: ${EXPECTED_PASS})"
log "Tests failed  : ${ACTUAL_FAIL}  (expected: ${EXPECTED_FAIL})"
log "Test exit code: ${TEST_EXIT}    (expected: 1)"
sep

# ---------------------------------------------------------------------------
# 5. Determine reproduction status
# ---------------------------------------------------------------------------
REPRODUCTION_STATUS="INCONCLUSIVE"
SCRIPT_EXIT=2

if [[ "${ACTUAL_FAIL}" == "${EXPECTED_FAIL}" && \
      "${ACTUAL_PASS}" == "${EXPECTED_PASS}" && \
      "${ACTUAL_TOTAL}" == "${EXPECTED_TOTAL}" ]]; then
  REPRODUCTION_STATUS="FAILURE REPRODUCED"
  SCRIPT_EXIT=0
else
  REPRODUCTION_STATUS="UNEXPECTED RESULT - investigate"
  SCRIPT_EXIT=2
fi

echo ""
if [[ "${SCRIPT_EXIT}" -eq 0 ]]; then
  pass "[REPRODUCED] ${REPRODUCTION_STATUS}"
  pass "The known timezone bug has been confirmed in the SHADOWBOX environment."
else
  fail "[UNEXPECTED] ${REPRODUCTION_STATUS}"
  fail "The result did not match expected failure counts."
  fail "Review the output above and compare with shadowbox/environment.json."
fi

sep
log "Note: Test exit code ${TEST_EXIT} is the raw Docker/test-runner result."
log "      A non-zero test exit code is EXPECTED when the bug is reproduced."
log "      Reproduction status above is the meaningful SHADOWBOX signal."
sep

exit "${SCRIPT_EXIT}"
