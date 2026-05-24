#!/bin/sh
set -e

PORT="${PORT:-4200}"
ROOT="${RUNTIME_STATIC_ROOT:-dist/web/browser}"
DRIVER_PORT="${RUNTIME_DRIVER_PORT:-8090}"

if [ ! -d "${ROOT}" ]; then
  echo "Runtime static root missing: ${ROOT}" >&2
  exit 1
fi

echo "Runtime serving ${ROOT} on :${PORT} (mock-static)"
serve -s "${ROOT}" -l "${PORT}" --no-port-switching &
SERVE_PID=$!

cleanup() {
  kill "${SERVE_PID}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Runtime driver API on :${DRIVER_PORT}"
export RUNTIME_DRIVER_PORT="${DRIVER_PORT}"
exec npx tsx v2/src/runtime/api/server.ts
