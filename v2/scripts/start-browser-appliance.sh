#!/bin/sh
# Start local browser appliance for CDP mode (macOS/Linux dev).
# Usage: ./v2/scripts/start-browser-appliance.sh
# Then:  BROWSER_CDP_URL=http://127.0.0.1:9222 npm run bench:v2

set -e

PORT="${BROWSER_CDP_PORT:-9222}"
HEADLESS="${BROWSER_HEADLESS:-1}"

CHROMIUM="${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}"
if [ -z "${CHROMIUM}" ]; then
  CHROMIUM=$(node -e "const { chromium } = require('@playwright/test'); process.stdout.write(chromium.executablePath());")
fi

ARGS="
  --remote-debugging-port=${PORT}
  --remote-debugging-address=127.0.0.1
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

echo "Browser appliance: ${CHROMIUM}"
echo "CDP: http://127.0.0.1:${PORT}"
# shellcheck disable=SC2086
exec "${CHROMIUM}" ${ARGS} about:blank
