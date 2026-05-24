#!/bin/sh
set -e
# Clients container — API server (orchestrator connects remotely) or embedded worker mode.

: "${PLAYWRIGHT_BASE_URL:?PLAYWRIGHT_BASE_URL required — e.g. http://runtime:4200 or https://www.euro.com.pl}"
: "${BROWSER_CDP_URL:?BROWSER_CDP_URL required — e.g. http://browser:9222}"

export CI="${CI:-1}"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-1}"
export PLAYWRIGHT_SKIP_WEBSERVER="${PLAYWRIGHT_SKIP_WEBSERVER:-1}"
export BENCH_HOST_CLASS="${BENCH_HOST_CLASS:-docker-cdp-split}"
export CLIENTS_API_PORT="${CLIENTS_API_PORT:-8080}"
export CWV_REPO_ROOT="${CWV_REPO_ROOT:-/app}"

echo "Clients → browser CDP: ${BROWSER_CDP_URL}"
echo "Clients → app target:  ${PLAYWRIGHT_BASE_URL}"
echo "Mode:                  ${CWV_CLIENTS_MODE:-worker}"

if [ "${CWV_CLIENTS_MODE:-worker}" = "api" ]; then
  echo "Clients API port:      ${CLIENTS_API_PORT}"
  exec npm run bench:v2:clients-api
fi

echo "Replicates:            ${BENCH_REPLICATES:-1}"
exec npm run bench:v2
