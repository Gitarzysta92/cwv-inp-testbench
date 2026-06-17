# Agent Onboarding

This repository is a Core Web Vitals test bench. Its current main use case is
measuring INP for real Euro.com.pl user paths under different browser runtime
conditions.

Use this file as the first stop for a new coding agent or contributor. The
operational playbooks live in [SKILLS.md](./SKILLS.md).

## First Interaction Protocol

On the first response in a new thread after reading this file, start with an
`Interaction Description` block before running tools or proposing changes.

Use this exact shape:

```text
Interaction Description
- Repository: one sentence about what this bench does.
- Request: one sentence about what the user is asking for.
- Likely areas: files, modules, or commands that are probably relevant.
- First action: the next concrete step you will take.
```

Keep it under six lines. Do not use this block when the user explicitly asks for
only a direct answer, a command output, or a terse status update.

## Current Objective

The target model is live browser measurement, not offline replay as the primary
methodology.

The Euro default target is `EURO_APP_URL`, defined by the Euro profile builder
with fallback `https://www.euro.com.pl/`. `PLAYWRIGHT_BASE_URL` is the generic
runtime/session override and wins over profile `network.baseUrl`.

The most important current comparison is:

```text
baseline vs euro-menu-baseline-scripts-blocked
```

Run it across these runtime variants:

| Runtime | Script |
| --- | --- |
| Docker + Xvfb + container Chromium | `npm run bench:runtime:euro:menu:docker-headful-xvfb` |
| Local Chromium headful | `npm run bench:runtime:euro:menu:local-headful` |
| Local Chromium headless | `npm run bench:runtime:euro:menu:local-headless` |

All three runtime variants should behave like normal browser runs. They disable
runtime-managed replay cache in their profile configuration.

Known caveat: Docker + Xvfb + container Chromium has shown a runtime-specific
anomaly where blocked scripts can increase `inpPresentationDelayMs` while local
headful/headless show improvement or neutral results. Treat Docker/Xvfb-only
regressions as runtime-environment evidence until local controls confirm them.

## Repository Map

| Path | Purpose |
| --- | --- |
| `src/experiments/lab/euro-cwv-lab/` | Euro lab definition: profiles, scenarios, methodology |
| `src/experiments/runtime/` | Runtime-specific Euro menu runs and replay smoke tests |
| `src/runtime/essentials/` | Runtime core API: context, network target, policy, Docker image |
| `src/runtime/*.ts` | Concrete runtime implementations |
| `src/runtime/driver/cdp/` | CDP browser session, network blocking, warmup, response cache |
| `src/scenarios/playwright-web-vitals/` | Playwright scenarios and web-vitals instrumentation |
| `src/lab/` | Report contract, aggregation, validation, result writer |
| `src/orchestrator/` | Session loop, scheduling, runtime API client |
| `bench-results/` | Generated observations and reports; do not commit new run output by default |

## Architecture

```text
LabDefinition
  -> Orchestrator schedule
  -> Runtime prepares browser/session
  -> Playwright client runs scenario
  -> Observation JSON
  -> Lab aggregate
  -> report.json + report.tsv
```

Layer ownership:

| Layer | Owns |
| --- | --- |
| Lab | Methodology, profiles, scenarios, validation, aggregation |
| Runtime | Browser process/session, app target, network policy, warmup |
| Client/scenario | User interaction and web-vitals collection |
| Orchestrator | Repeated execution and persistence |

Keep these boundaries intact. Do not put scenario logic into runtime code. Do
not put browser/network setup into scenario code when the runtime API is in use.

## Report Contract

The report metric whitelist is in `src/lab/report.ts`.

Current first-class TSV metrics include:

```text
inpMs
inpInputDelayMs
inpProcessingDurationMs
inpPresentationDelayMs
fcpMs
lcpMs
cls
ttfbMs
eventTimingMaxMs
eventTimingCount
scenarioDurationMs
interactionWallMs
homeLoadWaitMs
homeLoadTimedOut
warmup*
networkBlockedByPolicy
```

Runtime-cache diagnostics belong in `observation.meta.network`, not in the main
TSV metric list. Full network/console dumps are debug-only and should require:

```bash
BENCH_DEBUG_ARTIFACTS=1
```

Chrome trace and CPU profile are separate debug switches:

```bash
BENCH_CHROME_TRACE=1
BENCH_CPU_PROFILE=1
```

## Script Blocking Policy

Blocked scripts are aborted through Chrome `Network.setBlockedURLs`.

`blockScriptsMode` and `empty-response` are intentionally unsupported. If a
profile or API payload provides `blockScriptsMode`, validation should reject it.

## Common Commands

Install:

```bash
npm ci
```

Typecheck:

```bash
npx tsc --noEmit
```

Docker image build:

```bash
npm run runtime:docker:build
```

Runtime comparison smoke run:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:docker-headful-xvfb
```

Local runtime variants:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headless

BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:local-headful
```

Debug run:

```bash
BENCH_REPLICATES=1 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
BENCH_DEBUG_ARTIFACTS=1 \
npm run bench:runtime:euro:menu:docker-headful-xvfb
```

## Reading Results

Reports are written to:

```text
bench-results/observations/<sessionId>/
bench-results/summary/<sessionId>/report.json
bench-results/summary/<sessionId>/report.tsv
```

Use `report.tsv` for quick comparison. Key columns:

| Column | Meaning |
| --- | --- |
| `profileId` | Tested profile |
| `metric` | Aggregated metric |
| `median`, `mean`, `min`, `max` | Qualified sample statistics |
| `delta` | `max - min` inside this row |
| `baselineMedianDelta` | Difference vs baseline profile |
| `gate` | Pass/fail only for methodology primary metric |

For INP diagnosis, read `inpPresentationDelayMs`, `inpInputDelayMs`, and
`inpProcessingDurationMs` alongside `inpMs`.

## Development Rules

- Prefer existing project patterns over new abstractions.
- Keep runtime implementations in `src/runtime/*.ts`.
- Keep shared runtime API/core in `src/runtime/essentials/`.
- Keep concrete runtime exports out of `essentials`.
- Use abort-only script blocking.
- Do not promote diagnostic-only fields into TSV unless they answer a
  methodology question.
- Do not commit generated `bench-results/` output unless explicitly requested.
- Do not touch unrelated untracked artifacts such as `presentation-data/`.

## Verification Before Hand-off

For code changes:

```bash
npx tsc --noEmit
git diff --check
```

For runtime/report changes, also run at least one small runtime comparison:

```bash
BENCH_REPLICATES=3 \
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked \
npm run bench:runtime:euro:menu:docker-headful-xvfb
```

If changing runtime portability, run all three runtime variants with the same
profiles and replicate count.
