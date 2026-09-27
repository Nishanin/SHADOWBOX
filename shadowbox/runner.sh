#!/usr/bin/env bash
# =============================================================================
# runner.sh -- SHADOWBOX Source-Variant Execution Engine (Bash / Linux / macOS)
# =============================================================================
# Orchestrates isolated execution for approved variants (reproduction, verification)
# using ephemeral contexts extracted via git archive.
# =============================================================================

set -uo pipefail

VARIANT="${1:-}"
FORMAT="text"
if [ "${2:-}" = "--json" ] || [ "${2:-}" = "json" ] || [ "${3:-}" = "--json" ] || [ "${3:-}" = "json" ]; then
  FORMAT="json"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VARIANTS_CONFIG="${SCRIPT_DIR}/variants.json"

log()  { if [ "${FORMAT}" = "text" ]; then echo "[SHADOWBOX] $*"; fi; }
sep()  { if [ "${FORMAT}" = "text" ]; then echo "[SHADOWBOX] ============================================================"; fi; }
pass() { if [ "${FORMAT}" = "text" ]; then echo "[PASS] $*"; fi; }
warn() { if [ "${FORMAT}" = "text" ]; then echo "[WARN] $*"; fi; }
err()  { if [ "${FORMAT}" = "text" ]; then echo "[FAIL] $*"; fi; }
info() { if [ "${FORMAT}" = "text" ]; then echo "[INFO] $*"; fi; }

START_TIME=$(date +%s%N 2>/dev/null || date +%s)
STATUS="INFRASTRUCTURE_ERROR"
ERROR_CATEGORY=""
ERROR_MSG=""
SOURCE_COMMIT=""
IMAGE_TAG=""
TOTAL_TESTS="null"
PASSED_TESTS="null"
FAILED_TESTS="null"
TEST_EXIT_CODE="null"
STDOUT_CAPTURED=""
CONTEXT_DIR=""
EXIT_CODE=3

cleanup() {
  if [ -n "${CONTEXT_DIR}" ] && [ -d "${CONTEXT_DIR}" ]; then
    rm -rf "${CONTEXT_DIR}" 2>/dev/null || true
  fi
  if [ -n "${IMAGE_TAG}" ]; then
    docker rmi -f "${IMAGE_TAG}" &>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

render_output() {
  END_TIME=$(date +%s%N 2>/dev/null || date +%s)
  local duration_ms=0
  if [ ${#START_TIME} -gt 10 ] && [ ${#END_TIME} -gt 10 ]; then
    duration_ms=$(( (END_TIME - START_TIME) / 1000000 ))
  fi
  local duration_s="0s"
  if [ "${duration_ms}" -gt 0 ]; then
    duration_s=$(node -e "console.log((${duration_ms} / 1000).toFixed(2) + 's')")
  fi

  if [ "${FORMAT}" = "json" ]; then
    node -e "
      const contract = {
        variant: process.argv[1],
        sourceCommit: process.argv[2] === '' ? null : process.argv[2],
        imageTag: process.argv[3] === '' ? null : process.argv[3],
        totalTests: process.argv[4] === 'null' ? null : parseInt(process.argv[4], 10),
        passedTests: process.argv[5] === 'null' ? null : parseInt(process.argv[5], 10),
        failedTests: process.argv[6] === 'null' ? null : parseInt(process.argv[6], 10),
        testExitCode: process.argv[7] === 'null' ? null : parseInt(process.argv[7], 10),
        status: process.argv[8],
        stdout: process.env.SB_STDOUT || '',
        stderr: process.argv[9] || '',
        duration: process.argv[10],
        durationMs: parseInt(process.argv[11], 10),
        errorCategory: process.argv[12] === '' ? null : process.argv[12]
      };
      console.log(JSON.stringify(contract, null, 2));
    " "${VARIANT}" "${SOURCE_COMMIT}" "${IMAGE_TAG}" "${TOTAL_TESTS}" "${PASSED_TESTS}" "${FAILED_TESTS}" "${TEST_EXIT_CODE}" "${STATUS}" "${ERROR_MSG}" "${duration_s}" "${duration_ms}" "${ERROR_CATEGORY}"
  else
    sep
    info "Status         : ${STATUS}"
    info "Duration       : ${duration_s}"
    if [ -n "${ERROR_CATEGORY}" ]; then
      info "Error Category : ${ERROR_CATEGORY}"
    fi
    info "Runner Exit    : ${EXIT_CODE}"
    sep
  fi
}

# 1. Parameter and config validation
if [ -z "${VARIANT}" ]; then
  ERROR_CATEGORY="INVALID_VARIANT"
  ERROR_MSG="Variant parameter is required. Usage: $0 <reproduction|verification> [--json]"
  err "${ERROR_MSG}"
  render_output
  exit 3
fi

if [ ! -f "${VARIANTS_CONFIG}" ]; then
  ERROR_CATEGORY="CONFIG_NOT_FOUND"
  ERROR_MSG="Variants configuration file not found at: ${VARIANTS_CONFIG}"
  err "${ERROR_MSG}"
  render_output
  exit 3
fi

# 2. Parse variant configuration safely using Node
CONFIG_PARSED=$(node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const variant = process.argv[2];
  if (!cfg.allowedVariants || !cfg.allowedVariants.includes(variant)) {
    console.error('INVALID_VARIANT');
    process.exit(1);
  }
  const vdef = cfg.variants[variant];
  if (!vdef || !vdef.commit) {
    console.error('MISSING_COMMIT_DEF');
    process.exit(2);
  }
  const exp = vdef.expected;
  console.log(vdef.commit + ' ' + exp.totalTests + ' ' + exp.passedTests + ' ' + exp.failedTests + ' ' + exp.testExitCode);
" "${VARIANTS_CONFIG}" "${VARIANT}" 2>&1) || {
  ERROR_CATEGORY="INVALID_VARIANT"
  ERROR_MSG="Variant '${VARIANT}' is not allowed or invalid."
  err "${ERROR_MSG}"
  render_output
  exit 3
}

SOURCE_COMMIT=$(echo "${CONFIG_PARSED}" | awk '{print $1}')
EXP_TOTAL=$(echo "${CONFIG_PARSED}" | awk '{print $2}')
EXP_PASS=$(echo "${CONFIG_PARSED}" | awk '{print $3}')
EXP_FAIL=$(echo "${CONFIG_PARSED}" | awk '{print $4}')
EXP_EXIT=$(echo "${CONFIG_PARSED}" | awk '{print $5}')

# 3. Check Docker daemon availability
if ! command -v docker &>/dev/null; then
  ERROR_CATEGORY="DOCKER_NOT_INSTALLED"
  ERROR_MSG="Docker CLI executable not found in PATH."
  err "${ERROR_MSG}"
  render_output
  exit 3
fi

if ! docker info --format '{{.ServerVersion}}' &>/dev/null; then
  ERROR_CATEGORY="DOCKER_DAEMON_UNAVAILABLE"
  ERROR_MSG="Docker daemon is not running or not responding."
  err "${ERROR_MSG}"
  render_output
  exit 3
fi

# 4. Check Git commit existence
if ! git -C "${REPO_ROOT}" rev-parse --verify "${SOURCE_COMMIT}^{commit}" &>/dev/null; then
  ERROR_CATEGORY="MISSING_COMMIT"
  ERROR_MSG="Commit ${SOURCE_COMMIT} not found in local Git object store."
  err "${ERROR_MSG}"
  render_output
  exit 3
fi

sep
log "SHADOWBOX Variant Execution"
log "Variant       : ${VARIANT}"
log "Source commit : ${SOURCE_COMMIT}"
log "Isolation     : node:20-alpine | non-root (node) | TZ=UTC | network=none"
sep

# 5. Build ephemeral context
log "Building ephemeral context from git snapshot..."
CONTEXT_DIR=$(bash "${SCRIPT_DIR}/build-context.sh" "${VARIANT}" 2>&1) || {
  ERROR_CATEGORY="CONTEXT_BUILD_ERROR"
  ERROR_MSG="Failed to build context: ${CONTEXT_DIR}"
  err "${ERROR_MSG}"
  render_output
  exit 3
}

# Generate unique image tag
RAND_ID=$(od -N 6 -t x -A n /dev/urandom 2>/dev/null | tr -d ' ' || date +%s%N | cut -b1-12)
IMAGE_TAG="shadowbox-${VARIANT}:${RAND_ID}"

log "Ephemeral context created at: ${CONTEXT_DIR}"
log "Unique image tag: ${IMAGE_TAG}"

# 6. Build hardened Docker image
log "Building Docker image (isolated context)..."
BUILD_LOG=$(docker build \
  --file "${CONTEXT_DIR}/Dockerfile" \
  --tag "${IMAGE_TAG}" \
  "${CONTEXT_DIR}" 2>&1) || {
  ERROR_CATEGORY="BUILD_FAILED"
  ERROR_MSG="${BUILD_LOG}"
  err "Docker build failed."
  render_output
  exit 3
}
log "Docker image built successfully."

# 7. Run container with security isolation
log "Running container with security hardening:"
log "  --rm"
log "  --network none"
log "  --memory 512m"
log "  --cpus 1.0"
echo ""

TEST_EXIT_CODE=0
TEST_OUTPUT=$(docker run \
  --rm \
  --network none \
  --memory 512m \
  --cpus 1.0 \
  "${IMAGE_TAG}" 2>&1) || TEST_EXIT_CODE=$?

export SB_STDOUT="${TEST_OUTPUT}"
if [ "${FORMAT}" = "text" ]; then
  echo "${TEST_OUTPUT}"
  echo ""
fi

# 8. Parse test results using portable POSIX sed
PARSED_TOTAL=$(echo "${TEST_OUTPUT}" | sed -n -E 's/.*tests[[:space:]]+([0-9]+).*/\1/p' | tail -n 1 || echo "")
PARSED_PASS=$(echo "${TEST_OUTPUT}"  | sed -n -E 's/.*pass[[:space:]]+([0-9]+).*/\1/p'  | tail -n 1 || echo "")
PARSED_FAIL=$(echo "${TEST_OUTPUT}"  | sed -n -E 's/.*fail[[:space:]]+([0-9]+).*/\1/p'  | tail -n 1 || echo "")

if [ -n "${PARSED_TOTAL}" ] && [ -n "${PARSED_PASS}" ]; then
  TOTAL_TESTS="${PARSED_TOTAL}"
  PASSED_TESTS="${PARSED_PASS}"
  FAILED_TESTS="${PARSED_FAIL:-0}"

  sep
  log "EXECUTION METRICS"
  sep
  log "Tests total    : ${TOTAL_TESTS} (expected: ${EXP_TOTAL})"
  log "Tests passed   : ${PASSED_TESTS} (expected: ${EXP_PASS})"
  log "Tests failed   : ${FAILED_TESTS} (expected: ${EXP_FAIL})"
  log "Test exit code : ${TEST_EXIT_CODE} (expected: ${EXP_EXIT})"
  sep

  if [ "${VARIANT}" = "reproduction" ]; then
    if [ "${TOTAL_TESTS}" = "${EXP_TOTAL}" ] && \
       [ "${PASSED_TESTS}" = "${EXP_PASS}" ] && \
       [ "${FAILED_TESTS}" = "${EXP_FAIL}" ] && \
       [ "${TEST_EXIT_CODE}" = "${EXP_EXIT}" ]; then
      STATUS="REPRODUCED"
      ERROR_CATEGORY=""
      EXIT_CODE=0
      pass "[REPRODUCED] DEFECT CONFIRMED"
      pass "Known timezone failure verified in Shadowbox runtime."
    else
      STATUS="UNEXPECTED_RESULT"
      ERROR_CATEGORY="UNEXPECTED_TEST_METRICS"
      EXIT_CODE=2
      warn "[UNEXPECTED_RESULT] Test counts did not match expected reproduction profile."
    fi
  elif [ "${VARIANT}" = "verification" ]; then
    if [ "${TOTAL_TESTS}" = "${EXP_TOTAL}" ] && \
       [ "${PASSED_TESTS}" = "${EXP_PASS}" ] && \
       [ "${FAILED_TESTS}" = "${EXP_FAIL}" ] && \
       [ "${TEST_EXIT_CODE}" = "${EXP_EXIT}" ]; then
      STATUS="VERIFIED"
      ERROR_CATEGORY=""
      EXIT_CODE=0
      pass "[VERIFIED] FIX CONFIRMED"
      pass "All tests pass cleanly in isolated Shadowbox runtime."
    else
      STATUS="UNEXPECTED_RESULT"
      ERROR_CATEGORY="UNEXPECTED_TEST_METRICS"
      EXIT_CODE=2
      warn "[UNEXPECTED_RESULT] Verification did not match expected passing profile."
    fi
  fi
else
  STATUS="INFRASTRUCTURE_ERROR"
  ERROR_CATEGORY="OUTPUT_PARSE_ERROR"
  ERROR_MSG="Could not parse TAP test metrics from container execution."
  EXIT_CODE=3
  err "[INFRASTRUCTURE_ERROR] Test metrics could not be parsed."
fi

render_output
exit ${EXIT_CODE}
