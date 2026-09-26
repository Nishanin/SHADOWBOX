# =============================================================================
# SHADOWBOX - Reproduction Environment
# =============================================================================
# Purpose:
#   Reproduce the deterministic timezone-dependent test failure from demo-app/.
#
# Bug summary:
#   invoiceChecker.js uses local-timezone Date methods (getDate, getMonth,
#   getFullYear) to extract a calendar date from a UTC ISO timestamp.
#   When TZ=UTC the test expects an invoice stored at 2024-01-14T23:30:00Z
#   to be "due on 2024-01-15", but the local date evaluates to 2024-01-14.
#
# Expected result inside this container:
#   tests: 5 total  |  pass: 2  |  fail: 3
#   Reproduction status: FAILURE REPRODUCED
# =============================================================================

FROM node:20-alpine

# ---------------------------------------------------------------------------
# 1. Force UTC timezone - this is the key environmental trigger.
#    node:*-alpine images default to UTC, but we set it explicitly so the
#    intent is unambiguous and survives any base-image change.
# ---------------------------------------------------------------------------
ENV TZ=UTC

# ---------------------------------------------------------------------------
# 2. Create a non-root working directory
# ---------------------------------------------------------------------------
WORKDIR /app

# ---------------------------------------------------------------------------
# 3. Copy only the files needed to install dependencies, then install.
#    Copying package files first lets Docker cache the npm install layer
#    independently of source changes.
# ---------------------------------------------------------------------------
COPY demo-app/package.json       ./package.json
COPY demo-app/package-lock.json  ./package-lock.json

RUN npm ci --omit=dev 2>/dev/null || npm install

# ---------------------------------------------------------------------------
# 4. Copy application source and test suite.
#    node_modules is excluded (installed above) - no .dockerignore needed
#    because we copy named paths only.
# ---------------------------------------------------------------------------
COPY demo-app/src/    ./src/
COPY demo-app/tests/  ./tests/

# ---------------------------------------------------------------------------
# 5. Emit environment metadata at container startup, then run the tests.
#    The node --test runner exits non-zero when any test fails.
#    That exit code is preserved and captured by reproduce.sh.
# ---------------------------------------------------------------------------
CMD ["sh", "-c", \
  "echo '=== SHADOWBOX ENVIRONMENT ===' && \
   echo \"Node version : $(node --version)\" && \
   echo \"npm  version : $(npm --version)\" && \
   echo \"TZ           : ${TZ}\" && \
   echo \"UTC offset   : $(node -e 'process.stdout.write(String(new Date().getTimezoneOffset()) + \" minutes\")')\" && \
   echo '=============================' && \
   echo ''; \
   node --test tests/invoiceChecker.test.js; \
   TEST_EXIT=$?; \
   echo ''; \
   echo \"Test exit code: ${TEST_EXIT}\"; \
   exit ${TEST_EXIT}" \
]
