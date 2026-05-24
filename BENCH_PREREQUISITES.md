# Bench prerequisites vs this repo

Pełny opis labu (tabela eksperyment / metodologia / środowisko): [`CWV_LAB.md`](./CWV_LAB.md).

This document maps your lab guidelines to **what the codebase enforces** versus **what must be handled on the host / cluster**.

## A) Device / host

| Guideline | In repo? |
|-----------|-----------|
| CPU stability (turbo off), governor | No — OS / bare-metal / node image |
| Virtual monitor (Xvfb) | Partial — use headed + `DISPLAY` + Xvfb in CI; Playwright Docker image is typically headless-friendly |
| Fixed RAM / no swap pressure | No — orchestration / VM |
| Stable GPU vs software rendering | Partial — `BENCH_HEADED`, Chromium flags; pin GPU driver in host image |
| Thermal stability | No |
| Same kernel | No — golden host image |

## B) System

| Guideline | In repo? |
|-----------|-----------|
| Repeatable setup | Partial — Docker + pinned npm locks |
| Minimal background noise | No |
| Fixed browser version | Partial — `@playwright/test` + Playwright browser versions pinned in CI/Docker |
| Fixed timezone / locale | Yes — `timezoneId: 'UTC'`, `locale: 'en-US'` in `playwright.config.ts` |
| Fixed fonts | Partial — app uses system UI fonts; pin font packages on host for stricter labs |
| Disable auto-updates / cron | No |
| Stable DNS | Partial — mocked APIs avoid external DNS for app traffic |
| Same resolution / color depth | Partial — `viewport`, `deviceScaleFactor: 1` |
| Same user profile each run | Partial — fresh context per run; no persistent profile disk |

## C) Browser

| Guideline | In repo? |
|-----------|-----------|
| Same browser version | Partial — lock Playwright + browsers in CI |
| Disabled background networking | Partial — launch flags in `playwright.config.ts` |
| Disabled extensions | Partial — default Chromium profile without extensions |
| Stable network throttling | Partial — optional `page.route` mocks; add explicit throttling if needed |
| Same viewport | Yes — env `BENCH_VIEWPORT_*` |
| Fresh profile per run | Yes — isolated browser context; cold mode clears storage/cookies (`prepareBenchPage`) |

## D) Application

| Guideline | In repo? |
|-----------|-----------|
| Mock APIs / fixed payloads | Yes — `installBenchMocks`, `proxy.conf.cjs`, fixtures JSON |
| Fixed images | Yes — SVG data URLs in `product-demo.json` |
| Feature flags / auth | Partial — not modeled; extend mocks |
| Built assets / HTML / JS / CSS | Yes — `ng build` + static serve in Docker |
| Deterministic image cache | Partial — inline data URLs avoid extra network |
| Deterministic font path | Partial — system fonts unless you bundle subset |

## Measurements

### Input simulation (Playwright)

Fixed selectors, delays (`THINK_MS`, typing delay), scroll region interaction — implemented in `e2e/scenarios-a-d.spec.ts` and legacy `e2e/bench-scenarios.spec.ts`.

### INP (web-vitals)

The app loads `src/web-vitals-bench.ts` from `main.ts` and registers **`onINP`** (with `reportAllChanges: true`, `durationThreshold: 0`). The latest callback is stored on `window.__CWV_BENCH_VITALS__.inp`. Playwright reads **`inpMs`** (the metric `value`) via `collectLabMetrics()` / `readWebVitalsInp()` after `settleWebVitalsInp()`. This is the preferred **INP** signal for bench exports; `eventTimingMaxMs` remains a secondary probe.

### Targeted slowdown (lab)

`src/bench-slowdown.ts` busy-waits only for interactions whose nearest **`data-testid`** appears in **`window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__`** or **`window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__`**. Optional URL: **`?benchSlowClick=id:ms,id2:ms`** and **`?benchSlowKeydown=id:ms`**. Playwright helpers: `e2e/fixtures/targeted-slowdown.ts`. Bench orchestrator injects delays from **`BENCH_SLOW_CLICK_JSON`** / **`BENCH_SLOW_KEYDOWN_JSON`** (`e2e/fixtures/bench-env-setup.ts`). Sanity test **`e2e/bench-slowdown-validation.spec.ts`** is **skipped** when **`BENCH_SLOW_CLICK_JSON`** is set (matrix “slow” runs). Compare baseline vs slowed **`inpMs`**: **`npm run bench:compare`** → **`bench-matrix.compare.json`** → **`bench-results/summary.tsv`** (two **`configId`** rows per scenario).

### Warmup

| Mode | Behavior |
|------|-----------|
| `BENCH_WARMUP=cold` (default) | Clear cookies + storage before tests (`prepareBenchPage`). |
| `warm_assets` | Preload URL once, then `about:blank` before scenario (HTTP cache warm). |
| `warm_session` | Seeds `sessionStorage` after first hit (see `warmupNavigation`). |

Set on orchestrator matrix via `env` per configuration.

### Statistics

Orchestrator runs **N × configurations**; `bench-aggregate.mjs` outputs **p50 / p75 / p95** (configurable), **worst**, optional **trim**, and documents **`acceptableDeltaMs`** (e.g. ±40 ms) from `bench-matrix.config.json` for manual or CI gates.

## Test matrix axes (ideal vs realistic)

The JSON matrix (`bench-matrix.config.json`) models **browser/env knobs** via `configurations[].env`. Axes such as “SSR + mocked APIs”, “staging backend”, “third-party scripts”, “dedicated benchmark node”, “pinned cores” are **not automatic**: encode them as separate configurations (different `PLAYWRIGHT_BASE_URL`, flags, or runner labels) and keep hardware isolation in Kubernetes / Nomad.

## Scenarios A–D

Implemented as Angular routes under `/scenario/...` and Playwright tests in `e2e/scenarios-a-d.spec.ts`:

- **A** — Product gallery, measure 4th thumbnail click.  
- **B** — Home → category → scroll → filters 1–3 then interaction on filter 4 (metrics captured after sequence).  
- **C** — Polish phrase typing with per-key sampling.  
- **D** — Browse → add → cart → `+`.

## Stack: Playwright + Lighthouse

- **Playwright** — interaction sampling + orchestration + aggregation.  
- **Lighthouse** — `npm run lh` runs `scripts/lighthouse-run.mjs` against `LH_URL` (snapshot lab scores; not a substitute for interaction INP attribution).

## Docker: headful + Xvfb

The Playwright image installs **`xvfb`**. At runtime, set **`BENCH_USE_XVFB=1`**: the entrypoint starts **`Xvfb :99`**, sets **`DISPLAY=:99`**, and **`BENCH_HEADED=1`** so Chromium runs headed against the virtual framebuffer (typical Linux CI / benchmark appliance pattern).

Optional env: **`XVFB_WIDTH`**, **`XVFB_HEIGHT`**, **`XVFB_DEPTH`** (defaults `1280` / `720` / `24`, aligned with the default Playwright viewport).

Example:

```bash
docker build -t cwv-web-poc:e2e .
docker run --rm -e BENCH_USE_XVFB=1 cwv-web-poc:e2e
```
