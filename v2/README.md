# CWV Lab v2

```
lab
  cohort · methodology · client          ← bench client (playwright-web-vitals, …)
profiles[]                               ← runtime + client slices per measurement bucket
scenarios[]                              ← thin catalog (id, label, description)
       ↓
Orchestrator (Node, host)
  buildExecutionPlan → buildSessionPlan  ← client from lab.client
  optional: docker up runtime only
  for step: runtime.prepareRuntimeContext → clients.runScenario
  aggregate → report (fixed schema in lab/report.ts)
```

## Config shape

```ts
export const lab = {
  cohort: { hostClass, appVersion },
  methodology: { replicates, schedule, metric, percentiles, gate, … },
  client: 'playwright-web-vitals',   // ← one client per lab session
};

export const profiles = [{
  id, label, role,
  warmup, network, application,     // runtime slice
  device, system, browser,           // client slice
}];

export const scenarios = [{
  id, label, description: string[],  // no client here — use lab.client
}];
```

To compare clients, run separate lab sessions with a different `lab.client`.

Scenario scripts live in the client implementation (e.g. Playwright specs), not in config.

## Layer split

| Module | Responsibility |
| --- | --- |
| [`src/lab/`](./src/lab/) | Config schema, schedule, validate, aggregate |
| [`src/runtime/`](./src/runtime/) | App target: warmup, slowdown, `baseUrl` |
| [`src/clients/`](./src/clients/) | Viewport/browser env, scenario runners |
| [`src/orchestrator/`](./src/orchestrator/) | Session loop, optional runtime Docker |

## Docker: runtime only

Only the **runtime** (mock app) runs in Docker. Orchestrator, clients, and browser stay on the host.

```bash
npm run bench:v2:docker   # up runtime → bench on host → down runtime
```

Live labs (`network.kind: live`) skip Docker.

Optional `BROWSER_CDP_URL` env attaches to a remote browser appliance (not in config).

## Networking

| Layer | Declares |
| --- | --- |
| **Profile** | `network.kind`, `network.baseUrl?`, `application.apiMode` |
| **Orchestration** | `PLAYWRIGHT_BASE_URL` env override |

```ts
network: { kind: 'mock-static' }   // + runtime Docker or ng serve
network: { kind: 'live', baseUrl: 'https://www.euro.com.pl' }
```

## Runtime network policy

Declared on the **profile runtime slice** — enacted by client specs via env from `prepareRuntimeContext()`.

| Field | Location | Effect |
| --- | --- | --- |
| `network.kind`, `network.baseUrl` | profile | Where the browser navigates |
| `network.blockScripts` | profile | Abort listed script URLs in Playwright |
| `application.apiMode: 'mocked'` | profile | Enable `/api/*` route mocks |

```ts
network: {
  kind: 'mock-static',
  blockScripts: ['/assets/scripts/analytics.js'],
},
application: { apiMode: 'mocked', … },
```

`browser` slice is launch-only: `engine`, `headless`, `freshContextPerRun`, etc.

## Browser profile fields

| Field | Purpose |
| --- | --- |
| `headless`, `freshContextPerRun` | Playwright launch |

## Run

| Mode | Command |
| --- | --- |
| Local + ng serve | `npm start` then `npm run bench:v2` |
| Runtime in Docker | `npm run bench:v2:docker` |
| Live site | `network.kind: live` in profile, `npm run bench:v2` |

Results → `bench-results/v2/`.

Session plan = `profile × replicate × scenarios` with `lab.client`.
