# Lab experiments

Run real CWV measurements through the orchestrator: `LabDefinition` -> `runLabSession` -> runtime -> client -> Playwright scenarios -> `bench-results/`.

## Files in each experiment

| File | Role |
|------|------|
| `experiment.ts` | Entry point: resolve env, call `runLabSession`, print observations |
| `definition.ts` | `LabDefinition`: methodology, profiles, scenarios, spec paths |
| `profiles.ts` | Live app URL, script block patterns, `euroLiveProfile()` / `googleLiveProfile()` helpers |

Smaller probes may inline a minimal `LabDefinition` in `experiment.ts` and import `profiles.ts` + scenario IDs from a larger lab.

## Experiments

### `euro-cwv-lab`

Main Euro.com.pl study: 4 cache/network profiles x 13 active user scenarios x
10 replicates, primary local headless runtime per instruction. The promo tag
click scenario is kept as a disabled catalog entry because the current live
campaign no longer exposes a stable matching target.

```bash
npm run bench:euro
BENCH_REPLICATES=100 npm run bench:euro
```

### `euro-menu-lab`

Same methodology and profiles as `euro-cwv-lab`, but hamburger menu only (20 steps instead of 280).

```bash
npm run bench:euro:menu
BENCH_REPLICATES=100 npm run bench:euro:menu
```

Exports: `runEuroExperiment()`, `resolveEuroLabDefinition()`,
`euroMenuMethodologyLab`, and `euroMenuMethodologyDisabledScenarios`.

Other Euro experiments import `definition.ts` / `profiles.ts` from here when they share the same methodology or app setup.

### `euro-menu-probe`

Single-scenario check (hamburger menu only). One shared runtime stack instead of per-instruction runtime instances.

```bash
npx tsx src/experiments/lab/euro-menu-probe/experiment.ts --docker
npx tsx src/experiments/lab/euro-menu-probe/experiment.ts --local
```

### `google-web-vitals-probe`

Sanity probe on live Google: inject INP probe via `google-web-vitals-probe.spec.ts`.

```bash
npx tsx src/experiments/lab/google-web-vitals-probe/experiment.ts --docker
npx tsx src/experiments/lab/google-web-vitals-probe/experiment.ts --local
```

## Related code

- Framework types: `src/lab/types.ts`
- Generic runner: `src/orchestrator/run-lab-session.ts`
- Template config: `src/config.example.ts` (used by `npm run bench`)
- Scenarios: `src/scenarios/playwright-web-vitals/`

## Extending lab experiments

Use [../../../SKILLS.md](../../../SKILLS.md) for the operational playbooks:

| Task | Skill |
| --- | --- |
| Add a Euro user path | `Add A Euro Scenario` |
| Add or change a Euro profile | `Add Or Change A Euro Profile` |
| Add a focused wrapper or new lab | `Add A Lab Experiment` |

Keep reusable methodology in `definition.ts`. Use `experiment.ts` for CLI
resolution, runtime selection, and wrapper options. Add an npm script only when
the experiment should be a stable command.
