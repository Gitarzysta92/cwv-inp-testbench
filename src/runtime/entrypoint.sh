#!/bin/sh
set -e

CDP_PORT="${BROWSER_CDP_PORT:-9222}"
CDP_PUBLIC_PORT="${BROWSER_CDP_PUBLIC_PORT:-9223}"
DRIVER_PORT="${RUNTIME_DRIVER_PORT:-8090}"
HEADLESS="${BROWSER_HEADLESS:-1}"
USE_XVFB="${BENCH_USE_XVFB:-0}"

BROWSER_PID=""
CDP_FORWARD_PID=""
XVFB_PID=""
USER_DATA_DIR=""

cleanup() {
  [ -n "${BROWSER_PID}" ] && kill "${BROWSER_PID}" 2>/dev/null || true
  [ -n "${CDP_FORWARD_PID}" ] && kill "${CDP_FORWARD_PID}" 2>/dev/null || true
  [ -n "${XVFB_PID}" ] && kill "${XVFB_PID}" 2>/dev/null || true
  [ -n "${USER_DATA_DIR}" ] && rm -rf "${USER_DATA_DIR}"
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

USER_DATA_DIR=$(mktemp -d /tmp/cwv-browser-XXXXXX)

ARGS="
  --remote-debugging-port=${CDP_PORT}
  --remote-debugging-address=0.0.0.0
  --user-data-dir=${USER_DATA_DIR}
  --no-sandbox
  --disable-dev-shm-usage
  --disable-background-networking
  --disable-component-extensions-with-background-pages
  --disable-extensions
  --mute-audio
  --no-first-run
  --no-default-browser-check
"

if [ "${HEADLESS}" = "1" ]; then
  ARGS="${ARGS} --headless=new"
fi

echo "Starting Chromium CDP on 0.0.0.0:${CDP_PORT}"
# shellcheck disable=SC2086
"${CHROMIUM}" ${ARGS} about:blank &
BROWSER_PID=$!

CDP_READY=0
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1; then
    CDP_READY=1
    break
  fi
  sleep 0.5
done

if [ "${CDP_READY}" -ne 1 ]; then
  echo "Chromium CDP did not become ready on :${CDP_PORT}" >&2
  exit 1
fi

if [ "${CDP_PUBLIC_PORT}" != "${CDP_PORT}" ]; then
  echo "Forwarding Chromium CDP on 0.0.0.0:${CDP_PUBLIC_PORT} -> 127.0.0.1:${CDP_PORT}"
  socat "TCP-LISTEN:${CDP_PUBLIC_PORT},bind=0.0.0.0,fork,reuseaddr" "TCP:127.0.0.1:${CDP_PORT}" &
  CDP_FORWARD_PID=$!
fi

export BROWSER_CDP_URL="http://127.0.0.1:${CDP_PORT}"
export HOST_BROWSER_CDP_URL="${HOST_BROWSER_CDP_URL:-http://127.0.0.1:${CDP_PUBLIC_PORT}}"
export BROWSER_APP_BASE_URL="${BROWSER_APP_BASE_URL:-https://www.google.com}"
export RUNTIME_DRIVER_PORT="${DRIVER_PORT}"

echo "Runtime driver API on :${DRIVER_PORT} (app ${BROWSER_APP_BASE_URL})"
exec npx tsx src/runtime/api/server.ts
