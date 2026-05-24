#!/bin/sh
set -e

# Browser appliance: pinned Chromium + CDP on 0.0.0.0:9222.
# Code container connects via BROWSER_CDP_URL=http://browser:9222

PORT="${BROWSER_CDP_PORT:-9222}"
HEADLESS="${BROWSER_HEADLESS:-1}"
USE_XVFB="${BENCH_USE_XVFB:-0}"
XVFB_PID=""

cleanup() {
  [ -n "${XVFB_PID}" ] && kill "${XVFB_PID}" 2>/dev/null || true
}
trap cleanup EXIT

if [ "${USE_XVFB}" = "1" ]; then
  W=${XVFB_WIDTH:-1280}
  H=${XVFB_HEIGHT:-720}
  D=${XVFB_DEPTH:-24}
  export DISPLAY=:99
  Xvfb :99 -screen 0 "${W}x${H}x${D}" -ac +extension RANDR &
  XVFB_PID=$!
  sleep 1
  HEADLESS=0
fi

CHROMIUM="${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}"
if [ -z "${CHROMIUM}" ]; then
  CHROMIUM=$(ls /ms-playwright/chromium-*/chrome-linux/chrome 2>/dev/null | tail -1)
fi
if [ -z "${CHROMIUM}" ] || [ ! -x "${CHROMIUM}" ]; then
  echo "Chromium executable not found under /ms-playwright" >&2
  exit 1
fi

ARGS="
  --remote-debugging-port=${PORT}
  --remote-debugging-address=0.0.0.0
  --no-sandbox
  --disable-dev-shm-usage
  --disable-background-networking
  --disable-component-extensions-with-background-pages
  --disable-extensions
  --mute-audio
  --no-first-run
  --no-default-browser-check
  --password-store=basic
  --use-mock-keychain
"

if [ "${HEADLESS}" = "1" ]; then
  ARGS="${ARGS} --headless=new"
fi

# shellcheck disable=SC2086
exec "${CHROMIUM}" ${ARGS} about:blank
