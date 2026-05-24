# CWV Lab v2

TypeScript-first bench config: [`src/config.ts`](./src/config.ts).

```
lab          → cohort + methodology (session-wide)
profiles[]   → how to run (layers, warmup)
scenarios[]  → what to measure (A–D)
```

One session = one **cohort** × all **profiles** × all **scenarios** × **`replicates`** runs.

---

## Run schedule

`lab.methodology.schedule` controls **run order** when multiple profiles exist in the same cohort.  
Implemented by [`src/schedule.ts`](./src/schedule.ts) → `buildExecutionPlan(profileIds, replicates, schedule)`.

### `sequential`

Finish every replicate for profile A, then profile B.

```
profiles: [baseline, slow], replicates: 3

baseline #0 → baseline #1 → baseline #2 → slow #0 → slow #1 → slow #2
```

Same order as v1 [`scripts/bench-orchestrator.mjs`](../scripts/bench-orchestrator.mjs).

**Use when:** single profile, smoke runs, or no profile-to-profile comparison in this session.

### `interleave` (default in config)

Round-robin: one run per profile, then next replicate.

```
profiles: [baseline, slow], replicates: 3

baseline #0 → slow #0 → baseline #1 → slow #1 → baseline #2 → slow #2
```

**Why:** device-layer noise (CPU heat, throttling, background load) often **drifts over time**.  
With `sequential`, later profiles sit in a hotter/noisier part of the session, so

`Δ = p50(slow) − p50(baseline)`

can mix **profile effect** with **machine drift**.

`interleave` exposes both profiles to similar points in the session, so **delta gates** (`acceptableDeltaMs`) are fairer on a shared runner.

**Use when:** comparing profiles (baseline vs calibration/slow) or any regression gate on the same host.

### Example plan

```ts
import { profiles, lab } from './src/config';
import { buildExecutionPlan } from './src/schedule';

const plan = buildExecutionPlan(
  profiles.map((p) => p.id),
  lab.methodology.replicates,
  lab.methodology.schedule,
);
// [{ profileId: 'baseline', replicate: 0, stepIndex: 0 }, …]
```

With only one profile today, `sequential` and `interleave` produce the same order.  
Add a second profile (e.g. `slow`) to see the difference.

### Not compensated by schedule alone

- Cross-host comparison (different `cohort.hostClass`) — still invalid.
- Absolute `inpMs` targets — use distribution stats (p50/p75/worst) inside one cohort.
- Optional future knobs: `discardFirstReplicate`, control profile every N steps (session drift check).

---

## Config reference

| Field | Level | Meaning |
| --- | --- | --- |
| `lab.cohort` | session | Where + which build — do not compare across cohorts |
| `lab.methodology.replicates` | session | Runs per profile |
| `lab.methodology.schedule` | session | `sequential` \| `interleave` |
| `lab.methodology.gate` | session | Delta threshold vs baseline profile |
| `profiles[]` | matrix row | Device / system / browser / application + `warmup` |
| `scenarios[]` | measurement | Lab flows A–D (`scenario-*` ids match Playwright exports) |

---

## Wiring status

| Piece | Status |
| --- | --- |
| `config.ts` + `schedule.ts` | Declared |
| v1 orchestrator | Always **sequential** |
| v2 orchestrator | Not implemented — should call `buildExecutionPlan` before spawning Playwright |

Next: `toRuntimeEnv(profile)` → `BENCH_*` env, then orchestrator v2 loop over `plan[]`.
