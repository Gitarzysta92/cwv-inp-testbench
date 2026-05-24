# Docker images for v2 lab

**Default model: browser + runtime in Docker.** Orchestrator + clients run on the host.

| Service | API | Port | Role |
| --- | --- | --- | --- |
| **browser** | CDP (`/json/version`) | `:9222` | Chromium appliance |
| **runtime** | HTTP driver API + mock app | `:8090`, `:4200` | Applies profile config to browser; serves static app |

## Typical flow

```bash
npm run bench:v2:docker
# orchestrator → docker compose up browser + runtime
#              → POST runtime driver /v1/step/prepare (profile → browser setup)
#              → Playwright on host connects CDP → :9222
#              → docker compose down
```

Manual:

```bash
npm run bench:v2:docker:runtime   # browser + runtime containers
npm run bench:v2 -- --runtime-api-url http://127.0.0.1:8090
docker compose -f v2/docker/compose.runtime.yaml down
```

## Runtime driver API

| Endpoint | Description |
| --- | --- |
| `GET /health` | Driver + config probe |
| `GET /v1/browser/status` | Browser CDP health |
| `POST /v1/step/prepare` | Resolve profile, connect CDP, apply network policy |
| `POST /v1/step/release` | Tear down step browser session |

Prepare body: `{ profile, stepKey, baseUrlOverride? }` → `{ runtime, browser: { cdpUrl, appBaseUrl } }`.

When runtime runs in compose, `BROWSER_APP_BASE_URL=http://runtime:4200` is the navigation target inside the browser container. Host orchestrator receives `browser.cdpUrl=http://127.0.0.1:9222`.

## Live site (no runtime container)

```bash
npm run bench:v2   # profile.network.kind=live, browser → https://euro.com.pl
```

Orchestrator skips Docker when profiles don't need a mock app.

## Optional: full stack in Docker

For CI that wants everything containerized:

```bash
npm run bench:v2:docker:full   # runtime + browser + clients
npm run bench:v2:docker:live   # browser + clients, live URL
```

## Clients API (optional remote execution)

```bash
CWV_CLIENTS_MODE=api npm run bench:v2:clients-api
npm run bench:v2 -- --execution api --clients-api-url http://127.0.0.1:8080
```

## Build runtime image only

```bash
docker build -f v2/docker/runtime/Dockerfile -t cwv-v2-runtime .
```
