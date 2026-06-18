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

## Skill: Configure Euro Access Cookie

Use when Euro requires the `syzygyDev` cookie for local live-browser runs.

Files:

| File | Role |
| --- | --- |
| `.env.example` | Committed placeholder only |
| `.env` | Local ignored secret values |
| `src/scenarios/playwright-web-vitals/shared.ts` | Minimal `.env` loader |
| `src/scenarios/playwright-web-vitals/euro-helpers.ts` | `setSyzygyDevCookie()` helper |

Local setup:

```bash
cp .env.example .env
```

Then set the value locally:

```text
EURO_SYZYGY_DEV_COOKIE=<cookie-value>
```

Rules:

- Never commit `.env` or `.env.local`.
- Never paste the cookie value into docs, source, tests, commit messages, or
  benchmark output.
- Commit only empty placeholders in `.env.example`.
- Call `setSyzygyDevCookie(page, baseUrl)` before the first Euro navigation
  when a scenario needs the cookie.
- Listing scenarios already get the cookie through `navigateToSmartphonesListing()`.

Verification:

```bash
git check-ignore -v .env .env.local
git grep -l 'EURO_SYZYGY_DEV_COOKIE=.*[A-Za-z0-9]'
```

The first command should show `.gitignore` rules. The second command should
return no tracked files with a populated placeholder.

## Skill: Run A Runtime Comparison

Use when validating whether a runtime changes the measured INP behaviour.

Inputs:

```text
scenario: scenario-euro-open-menu
profiles: baseline,euro-menu-baseline-scripts-blocked
replicates: 3 for smoke, 10+ for stronger signal
primary runtime: local-headless
```

Commands:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headless

BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:docker-headful-xvfb

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
npm run bench:runtime:euro:menu:local-headless
```

Optional deeper debug:

```bash
BENCH_CHROME_TRACE=1 \
BENCH_CPU_PROFILE=1 \
BENCH_DEBUG_ARTIFACTS=1 \
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headless
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
| `README.md` | Scenario status table |

Pattern:

1. Define a stable scenario ID in `definition.ts`.
   Use the existing `scenario-euro-*` naming pattern.
2. Define a matching `*_SPEC_PATH` constant in `definition.ts`.
3. Add a `src/scenarios/playwright-web-vitals/euro-*.spec.ts` file.
4. Implement an `exercise*()` function that returns `EuroScenarioResult`.
5. Register the spec with `defineEuroScenarioTest({ id, title, exercise })`.
6. Use shared helpers such as `gotoEuroHome()`, `gotoEuroHomeSection()`,
   `navigateToSmartphonesListing()`, `clickByPattern()`, and
   `maybeClickByPattern()` before adding new selector logic.
7. Call `setSyzygyDevCookie(page, baseUrl)` before first navigation if the
   scenario does not use a helper that already sets it and the path needs the
   cookie.
8. Return `scenarioDurationMs`, `interactionWallMs`, `interactionLabel`, useful
   `meta`, and any scenario-specific numeric `metrics`.
9. Add the scenario to `euroMenuMethodologyLab.scenarios` only when it is stable
   enough for the default methodology.
10. If the scenario is useful but currently broken, add it to
    `euroMenuMethodologyDisabledScenarios` instead and document why.
11. Update the scenario table in `README.md`.

Minimal spec shape:

```ts
import type { Page } from 'playwright';
import {
  defineEuroScenarioTest,
  gotoEuroHome,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseExample(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);

  const interactionStartedAt = Date.now();
  // Perform the measured user interaction here.

  return {
    scenarioDurationMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: 'euro-example',
    meta: {},
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-example',
  title: 'euro example',
  exercise: exerciseExample,
});
```

Rules:

- Scenario code owns the user interaction, not runtime setup.
- Runtime code owns browser process, cache, network policy, and warmup.
- Keep selectors resilient to Euro markup changes, but do not hide real
  failures by matching unrelated UI.
- For PDP/listing paths, record Euro block state in `meta` or metrics when that
  state is part of the live-site behaviour.
- Do not commit generated `bench-results/` output unless explicitly requested.

Verification:

```bash
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline \
npm run bench:euro
```

For a narrower check, create or reuse a focused experiment wrapper that passes
`scenarioIds: ['scenario-euro-example']` into `runEuroExperiment()`.

## Skill: Add Or Change A Euro Profile

Use when changing cache, blocking, warmup, or target-network behaviour for Euro
measurements.

Files:

| File | Role |
| --- | --- |
| `src/experiments/lab/euro-cwv-lab/profiles.ts` | Euro defaults, script block patterns, profile builder |
| `src/experiments/lab/euro-cwv-lab/definition.ts` | Active profile list |
| `src/runtime/essentials/` | Shared runtime profile contract |
| `src/runtime/*.ts` | Runtime-specific profile adjustments |
| `README.md` | Profile table and methodology notes |

Pattern:

1. Add or update the profile in `euroMenuMethodologyProfiles`.
2. Keep IDs stable and descriptive because they appear in reports.
3. Keep `baseline` as the only baseline role unless the methodology changes.
4. Use abort-only script blocking through `blockScripts`.
5. Do not reintroduce `blockScriptsMode` or `empty-response`.
6. Prefer `EURO_APP_URL` or `PLAYWRIGHT_BASE_URL` for target changes instead of
   hardcoding temporary hosts.
7. Document new first-class profiles in `README.md`.

Verification:

```bash
npx tsc --noEmit
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,<new-profile-id> \
npm run bench:runtime:euro:menu:local-headless
```

## Skill: Add A Lab Experiment

Use when adding a runnable study setup, focused wrapper, or one-off lab entry
point.

Files:

| File | Role |
| --- | --- |
| `src/experiments/lab/<name>/experiment.ts` | CLI/run entry point |
| `src/experiments/lab/<name>/definition.ts` | LabDefinition, when the experiment owns one |
| `src/experiments/lab/<name>/profiles.ts` | Profile helpers, when not shared |
| `package.json` | npm script, if the experiment should be first-class |
| `src/experiments/README.md` | Global experiment index |
| `src/experiments/lab/README.md` | Lab-specific experiment index |

Choose the shape:

| Shape | Use |
| --- | --- |
| Full lab | The experiment owns its own methodology, profiles, or scenario set |
| Focused wrapper | The experiment reuses an existing lab and selects scenarios/profiles |
| Probe | The experiment is a temporary or diagnostic check with limited scope |

Pattern for a focused Euro wrapper:

```ts
import { runEuroExperiment, type RunEuroExperimentOptions } from '../euro-cwv-lab/experiment';
import { EURO_MENU_SCENARIO_ID } from '../euro-cwv-lab/definition';

export async function runEuroMenuLab(
  options: Omit<RunEuroExperimentOptions, 'scenarioIds' | 'title'> = {},
) {
  return runEuroExperiment({
    ...options,
    scenarioIds: [EURO_MENU_SCENARIO_ID],
    title: 'Euro menu lab',
  });
}
```

Rules:

- Put methodology and scenario catalog changes in the lab definition layer.
- Keep runtime selection in the entry point or runtime-specific wrapper.
- Add an npm script only for commands that should be discoverable and reused.
- Document the command and result interpretation in the appropriate README.
- Keep generated outputs out of commits unless requested.

Verification:

```bash
npx tsc --noEmit
BENCH_REPLICATES=1 npm run <new-script>
```

If the experiment changes runtime portability or report contract, also run the
small runtime comparison from `Skill: Run A Runtime Comparison`.

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
