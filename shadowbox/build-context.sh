#!/usr/bin/env bash
# =============================================================================
# build-context.sh -- Ephemeral Context Builder (Bash / Linux / macOS)
# =============================================================================
# Constructs a clean, isolated Docker build context from an approved
# git snapshot using git archive. Never touches working tree demo-app/.
# =============================================================================

set -euo pipefail

VARIANT="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VARIANTS_CONFIG="${SCRIPT_DIR}/variants.json"

log() { echo "[SHADOWBOX-BUILD-CONTEXT] $*"; }
err() { echo "[SHADOWBOX-BUILD-CONTEXT][ERROR] $*" >&2; }

if [ -z "${VARIANT}" ]; then
  err "Variant parameter is required. Usage: $0 <reproduction|verification>"
  exit 3
fi

if [ ! -f "${VARIANTS_CONFIG}" ]; then
  err "Variants configuration not found: ${VARIANTS_CONFIG}"
  exit 3
fi

# 1. Parse configuration safely using Node
CONFIG_PARSED=$(node -e "
  const fs = require('fs');
  const cfg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const variant = process.argv[2];
  if (!cfg.allowedVariants || !cfg.allowedVariants.includes(variant)) {
    console.error('INVALID_VARIANT: ' + variant + ' is not allowed.');
    process.exit(1);
  }
  const vdef = cfg.variants[variant];
  if (!vdef || !vdef.commit) {
    console.error('MISSING_COMMIT_DEF: No commit for ' + variant);
    process.exit(2);
  }
  console.log(vdef.commit + ' ' + (cfg.sourcePath || 'demo-app'));
" "${VARIANTS_CONFIG}" "${VARIANT}" 2>&1) || {
  err "${CONFIG_PARSED}"
  exit 3
}

COMMIT=$(echo "${CONFIG_PARSED}" | awk '{print $1}')
SOURCE_PATH=$(echo "${CONFIG_PARSED}" | awk '{print $2}')

# 2. Verify commit exists
if ! git -C "${REPO_ROOT}" rev-parse --verify "${COMMIT}^{commit}" &>/dev/null; then
  err "MISSING_COMMIT: Commit ${COMMIT} does not exist in local Git object store."
  exit 3
fi

# 3. Create ephemeral directories
CONTEXT_DIR=$(mktemp -d -t "shadowbox-ctx-${VARIANT}-XXXXXX")
TAR_FILE=$(mktemp -t "shadowbox-tar-XXXXXX.tar")
STAGE_DIR=$(mktemp -d -t "shadowbox-stage-XXXXXX")

cleanup_staging() {
  rm -f "${TAR_FILE}" 2>/dev/null || true
  rm -rf "${STAGE_DIR}" 2>/dev/null || true
}

cleanup_on_error() {
  cleanup_staging
  if [ -d "${CONTEXT_DIR}" ]; then
    rm -rf "${CONTEXT_DIR}" 2>/dev/null || true
  fi
}
trap cleanup_on_error ERR

# 4. Extract snapshot via git archive
git -C "${REPO_ROOT}" archive --format=tar --output="${TAR_FILE}" "${COMMIT}" "${SOURCE_PATH}"
tar -xf "${TAR_FILE}" -C "${STAGE_DIR}"

if [ ! -d "${STAGE_DIR}/${SOURCE_PATH}" ]; then
  err "INVALID_ARCHIVE_CONTENT: '${SOURCE_PATH}' not found inside archive."
  cleanup_on_error
  exit 3
fi

# 5. Populate context directory with expected structure
cp -R "${STAGE_DIR}/${SOURCE_PATH}/." "${CONTEXT_DIR}/"
cp "${SCRIPT_DIR}/Dockerfile" "${CONTEXT_DIR}/Dockerfile"

# Always cleanup tar and staging
cleanup_staging

# 6. Verify required context elements
for req in package.json src tests Dockerfile; do
  if [ ! -e "${CONTEXT_DIR}/${req}" ]; then
    err "INCOMPLETE_CONTEXT: Missing required element ${req} in context."
    rm -rf "${CONTEXT_DIR}" 2>/dev/null || true
    exit 3
  fi
done

# Output context directory path for caller
echo "${CONTEXT_DIR}"
