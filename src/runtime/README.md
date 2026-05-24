# Runtime

Runtime is the **browser measurement environment**: it prepares everything the browser needs for a lab step from the profile’s runtime slice, then exposes that environment to clients.

Runtime **serves and drives the browser** — app target, network policy, warmup/slowdown, and CDP-applied browser state — using config from `src/config.ts`. Clients **attach** to a prepared browser and **run scenarios** (measurement scripts only). The orchestrator schedules steps; it does not set up the browser.

```
profile (runtime slice)
        ↓
  runtime driver  ──→  mock app URL (network target)
        │              browser API (CDP / appliance)
        │              policy applied (mocks, blockScripts, warmup env)
        ↓
  RuntimeContext + browser endpoint
        ↓
  client.runScenario()   ← scenarios only, no environment setup
```

## What runtime owns

| Concern | Runtime | Client |
| --- | --- | --- |
| Where the app is (`network.kind`, `baseUrl`) | ✓ resolves | uses `baseUrl` |
| API mocks, script blocking | ✓ applies in browser | — |
| Warmup / slowdown policy | ✓ resolves → env / session | — |
| Browser process / CDP session | ✓ connects & configures | attaches over CDP |
| Viewport, locale, timezone | ✓ applies over CDP when using driver API | mirrored in client env |
| Headless / launch flags | container entrypoint / client launch | ✓ when launching locally |
| Scenario flows (click, type, measure INP) | — | ✓ |

The profile splits into **runtime slice** (`network`, `warmup`, `application`, `slowdown`) and **client slice** (`device`, `system`, `browser` launch preferences). See [`../lab/types.ts`](../lab/types.ts).

## Flow per step

1. Orchestrator calls runtime (`prepareRuntimeContext` for context-only runs, or the driver API for prepared-browser runs).
2. Runtime resolves the network target and builds `RuntimeContext` (`env`, `baseUrl`, `runtimeEnvironmentId`).
3. Runtime connects to the **browser API**, creates/configures a session from the profile (routes, blocked scripts, warmup knobs).
4. Client receives `RuntimeContext` + direct CDP browser endpoint, runs the scenario against that session.
5. Runtime releases the step session (`/v1/step/release` when using the driver API). Release is idempotent and returns `released: false` when the step is already gone.

## Modules

| File | Role |
| --- | --- |
| `prepare-context.ts` | Profile → `RuntimeContext` (env, baseUrl, fingerprints) |
| `network.ts` | Resolve navigation target (`mock-static` / `live` / override chain) |
| `network-policy.ts` | Resolve and export mock-api / blockScripts policy |
| `profile-slice.ts` | Runtime slice view + `runtimeEnvironmentId` fingerprint |
| `driver/cdp/` | Thin CDP driver: Fetch mocks, Network blocking, warmup, session |

### Driver API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness |
| `POST /v1/step/prepare` | Validate profile and apply it → `{ runtime, browser }` |
| `POST /v1/step/release` | Tear down step browser session; safe to call repeatedly |

Orchestrator uses `--runtime-api-url` when runtime runs out-of-process (e.g. Docker). Otherwise it calls `prepareRuntimeContext()` directly, which only builds the context/env and does not prepare a browser.

The runtime API and Chrome CDP are separate endpoints. In Docker, expose both ports and set `HOST_BROWSER_CDP_URL` to the host-reachable CDP URL. The image uses a plain TCP forwarder from `BROWSER_CDP_PUBLIC_PORT` to Chromium’s loopback-only CDP listener; runtime does not rewrite or proxy CDP at the HTTP/WebSocket layer.

## Boundaries

| Layer | Owns |
| --- | --- |
| **Lab** | Config, schedule, validation, aggregation |
| **Runtime** | App target + **browser environment** from profile |
| **Clients** | Scenario execution on a runtime-prepared browser |
| **Orchestrator** | Session loop, calling runtime then clients |

Runtime does **not** execute scenarios or produce reports. Clients do **not** own network policy or browser setup when runtime is in the loop.

## Tests

Small test client in `tests/runtime-client.ts` drives the runtime API + CDP browser.

```bash
npm run runtime:test -- --local   # chrome-launcher + driver on host
npm run runtime:test -- --docker  # build + run container
npm run runtime:test              # against already-running stack
npm run runtime:docker:build      # manual build
npm run runtime:docker:run        # manual run (foreground)
```

Live target default: `https://www.google.com`.
