# =============================================================================
# SHADOWBOX - Isolated Execution Environment
# =============================================================================
# Purpose:
#   Execute demo-app test suites under controlled, deterministic conditions.
#   Expects staged build context containing package.json, package-lock.json,
#   src/, and tests/.
# =============================================================================

FROM node:20-alpine

# ---------------------------------------------------------------------------
# 1. Force UTC timezone - environmental control.
# ---------------------------------------------------------------------------
ENV TZ=UTC

# ---------------------------------------------------------------------------
# 2. Non-root working directory
# ---------------------------------------------------------------------------
WORKDIR /app

# ---------------------------------------------------------------------------
# 3. Copy dependencies and install before switching user.
# ---------------------------------------------------------------------------
COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm ci 2>/dev/null || npm install

# ---------------------------------------------------------------------------
# 4. Copy application source and test suite.
# ---------------------------------------------------------------------------
COPY src/    ./src/
COPY tests/  ./tests/

# ---------------------------------------------------------------------------
# 5. Harden permissions and switch to unprivileged user.
# ---------------------------------------------------------------------------
RUN chown -R node:node /app
USER node

# ---------------------------------------------------------------------------
# 6. Container entrypoint: emit metadata and execute test runner.
# ---------------------------------------------------------------------------
CMD ["sh", "-c", \
  "echo '=== SHADOWBOX ENVIRONMENT ===' && \
   echo \"Node version : $(node --version)\" && \
   echo \"npm  version : $(npm --version)\" && \
   echo \"TZ           : ${TZ}\" && \
   echo \"User         : $(whoami)\" && \
   echo \"UTC offset   : $(node -e 'process.stdout.write(String(new Date().getTimezoneOffset()) + \" minutes\")')\" && \
   echo '=============================' && \
   echo ''; \
   node --test tests/invoiceChecker.test.js; \
   TEST_EXIT=$?; \
   echo ''; \
   echo \"Test exit code: ${TEST_EXIT}\"; \
   exit ${TEST_EXIT}" \
]
