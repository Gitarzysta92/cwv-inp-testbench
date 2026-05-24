#!/bin/sh
set -e
# Static SPA: production build has no /api — tests must mock (see e2e/fixtures/api-mock.ts).
#
# Headful + virtual display (Linux/Docker lab style):
#   BENCH_USE_XVFB=1  → start Xvfb on :99, DISPLAY=:99, BENCH_HEADED=1
# Optional: XVFB_WIDTH, XVFB_HEIGHT, XVFB_DEPTH (defaults match Playwright viewport).

SERVE_PID=""
XVFB_PID=""

cleanup() {
  [ -n "${SERVE_PID}" ] && kill "$SERVE_PID" 2>/dev/null || true
  [ -n "${XVFB_PID}" ] && kill "$XVFB_PID" 2>/dev/null || true
}
trap cleanup EXIT

if [ "${BENCH_USE_XVFB:-0}" = "1" ]; then
  W=${XVFB_WIDTH:-1280}
  H=${XVFB_HEIGHT:-720}
  D=${XVFB_DEPTH:-24}
  export DISPLAY=:99
  Xvfb :99 -screen 0 "${W}x${H}x${D}" -ac +extension RANDR &
  XVFB_PID=$!
  export BENCH_HEADED=1
  sleep 1
fi

npx serve -s dist/web/browser -l 4200 --no-port-switching &
SERVE_PID=$!
sleep 2

export PLAYWRIGHT_SKIP_WEBSERVER=1
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:4200}"
export CI=1

set +e
npx playwright test "$@"
STATUS=$?
set -e
exit "$STATUS"
