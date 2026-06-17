# Project Skills

This file is a compact playbook for common work in the CWV test bench. Each
skill describes when to use it, the relevant files, commands, and the expected
output.

## Skill: Configure Target URL

Use when changing which page or host the bench should examine.

There are two URL layers:

| Variable | Scope | Use |
| --- | --- | --- |
| `EURO_APP_URL` | Euro profile default | Changes the default `network.baseUrl` while building Euro profiles |
| `PLAYWRIGHT_BASE_URL` | Generic runtime/session override | Overrides the resolved URL for any profile at runtime |

The default Euro page is defined in:

```text
src/experiments/lab/euro-cwv-lab/profiles.ts
```

Current model:

```ts
export const EURO_APP_URL = process.env['EURO_APP_URL'] ?? 'https://www.euro.com.pl/';
```

Resolution order:

```text
PLAYWRIGHT_BASE_URL / orchestrator override
  -> profile.network.baseUrl
  -> default for network.kind
```

Use `EURO_APP_URL` when the whole Euro lab should be built around another Euro
host:

```bash
EURO_APP_URL=https://staging.example.com/ \
BENCH_REPLICATES=3 \
npm run bench:runtime:euro:menu:local-headless
```

Use `PLAYWRIGHT_BASE_URL` when you want a generic runtime override regardless of
what the profile says:

```bash
PLAYWRIGHT_BASE_URL=https://staging.example.com/ \
BENCH_REPLICATES=3 \
npm run bench:runtime:euro:menu:local-headless
```

Do not hardcode temporary test hosts into lab definitions. Prefer env overrides
for one-off runs.

## Skill: Run A Runtime Comparison

Use when validating whether a runtime changes the measured INP behaviour.

Inputs:

```text
scenario: scenario-euro-open-menu
profiles: baseline,euro-menu-baseline-scripts-blocked
replicates: 3 for smoke, 10+ for stronger signal
```

Commands:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:docker-headful-xvfb

BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headless

BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headful
```

Read:

```text
bench-results/summary/<sessionId>/report.tsv
```

Compare these metrics first:

```text
inpMs
inpPresentationDelayMs
inpInputDelayMs
inpProcessingDurationMs
eventTimingMaxMs
scenarioDurationMs
networkBlockedByPolicy
homeLoadTimedOut
```

Expected interpretation:

- `networkBlockedByPolicy > 0` only for the blocked profile.
- `homeLoadTimedOut` should normally stay `0`.
- `inpPresentationDelayMs` explains most "same INP but different rendering"
  questions.
- If only Docker/Xvfb differs from local headful/headless, investigate the
  runtime environment rather than the scenario.

## Skill: Debug Network And Console Behaviour

Use when a run result is surprising or a script-blocking hypothesis needs
evidence.

Command:

```bash
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
BENCH_DEBUG_ARTIFACTS=1 \
npm run bench:runtime:euro:menu:docker-headful-xvfb
```

Optional deeper debug:

```bash
BENCH_CHROME_TRACE=1 \
BENCH_CPU_PROFILE=1 \
BENCH_DEBUG_ARTIFACTS=1 \
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:docker-headful-xvfb
```

Artifacts:

```text
bench-results/observations/<sessionId>/_playwright-invocations/*-debug/
bench-results/observations/<sessionId>/*__rN__*.json
```

Look for:

- `consoleMessagesJson`
- `networkResponsesJson`
- `networkFailedRequestsJson`
- `browserRuntimeErrorsJson`
- screenshots `01-home-ready.png` through `04-menu-after-wait.png`
- optional trace/profile JSON when the trace/profile flags are enabled

Do not leave full network/console dumps enabled for normal benchmark runs.

## Skill: Add Or Change A Runtime

Use when adding a new browser execution environment.

Files:

| File | Role |
| --- | --- |
| `src/runtime/<runtime-name>.ts` | Concrete runtime implementation |
| `src/runtime/essentials/` | Shared runtime API only |
| `src/experiments/runtime/euro-menu-<runtime>/experiment.ts` | Runtime-specific entry point |
| `package.json` | npm script |
| `src/experiments/runtime/README.md` | Documentation |

Rules:

- Concrete runtime details belong in the concrete runtime file, even if this
  creates some duplication.
- `src/runtime/essentials/index.ts` should export core API only.
- Runtime Euro menu runs should disable `runtimeNetworkCache`.
- Runtime IDs should be stable because they appear in reports.
- Keep browser headless/headful differences explicit in the runtime definition.

Verification:

```bash
npx tsc --noEmit
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:<runtime-script>
```

## Skill: Change Report Metrics

Use when a metric should appear in `report.tsv`.

Files:

| File | Role |
| --- | --- |
| `src/lab/report.ts` | Metric whitelist |
| `src/scenarios/playwright-web-vitals/shared.ts` | Metric extraction from web-vitals/browser state |
| `src/scenarios/playwright-web-vitals/euro-helpers.ts` | Euro scenario-level metrics |
| `src/lab/aggregate.ts` | Aggregation logic |

Rules:

- Add a metric to `OBSERVATION_METRICS` only if it should be part of the main
  report contract.
- Keep verbose diagnostics in `meta` or under `BENCH_DEBUG_ARTIFACTS=1`.
- Runtime-cache details stay in `meta.network`, not TSV.
- Use stable names with units, for example `inpPresentationDelayMs`.

Verification:

```bash
npx tsc --noEmit
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headless
```

Then check that `report.tsv` contains the new metric and no accidental debug
fields.

## Skill: Add A Euro Scenario

Use when adding a new user path to the Euro lab.

Files:

| File | Role |
| --- | --- |
| `src/scenarios/playwright-web-vitals/euro-*.spec.ts` | Scenario implementation |
| `src/scenarios/playwright-web-vitals/euro-helpers.ts` | Shared selectors/helpers |
| `src/experiments/lab/euro-cwv-lab/definition.ts` | Scenario ID, spec path, description |

Pattern:

1. Define a stable scenario ID.
2. Add a Playwright spec that calls `defineEuroScenarioTest`.
3. Use `gotoEuroHome` or listing/PDP helpers where possible.
4. Return `scenarioDurationMs`, `interactionWallMs`, and useful `meta`.
5. Be defensive when Euro blocks PDP/listing navigation; record the blocked
   state instead of pretending the full path succeeded.

Verification:

```bash
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline \
npm run bench:euro
```

If the full Euro lab is too broad, temporarily select the scenario in code or
through an experiment wrapper before committing.

## Skill: Investigate Docker + Xvfb Differences

Use when Docker/Xvfb results disagree with local headful/headless.

Known issue: Docker + Xvfb + container Chromium has produced worse
`inpPresentationDelayMs` for the blocked-scripts profile even when local
headful/headless show better or neutral results. This points at the runtime
environment, not automatically at the page or GTM blocking.

First reproduce:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:docker-headful-xvfb
```

Then run the local controls with the same inputs:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headful

BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headless
```

Useful debug flags:

```bash
BENCH_DEBUG_ARTIFACTS=1
BENCH_CHROME_TRACE=1
BENCH_CPU_PROFILE=1
BENCH_XVFB_CPU_THROTTLE_RATE=8
```

Compare:

- `inpPresentationDelayMs`
- `eventTimingMaxMs`
- `scenarioDurationMs`
- `homeLoadWaitMs`
- `networkBlockedByPolicy`
- console errors and network responses from debug artifacts

If blocked scripts are faster locally but slower only under Docker/Xvfb, treat
the runtime environment as the primary suspect.

## Skill: Remove Legacy Replay Influence

Use when old replay-cache behaviour leaks into target live-browser reports.

Checklist:

- `report.tsv` should not expose `runtimeCache*` as main metrics.
- `runtimeCache` may remain in `observation.meta.network`.
- Imported seed experiments are archival only.
- Live runtime Euro menu profiles should use `runtimeNetworkCache: disabled`
  through runtime `configureProfile`.
- `empty-response` script blocking must not be reintroduced.

Verification:

```bash
rg -n "empty-response|blockScriptsMode\\?:|runtimeCacheEnabled" src
npx tsc --noEmit
```

Allowed remaining `blockScriptsMode` references should only be validation errors
that reject the field.
