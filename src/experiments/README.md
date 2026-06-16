# Experiments

Runnable study setups for the CWV test bench. Each experiment lives in its own folder with an `experiment.ts` entry point.

Experiments are grouped by **what they do**, not by app (Euro vs Google):

| Type | Directory | Question it answers |
|------|-----------|---------------------|
| [Lab](./lab/README.md) | `lab/` | What is INP under these profiles × scenarios × runs? |
| [Runtime](./runtime/README.md) | `runtime/` | Does runtime/CDP (cache, replay, blocking) work correctly? |
| [Import](./import/README.md) | `import/` | How do we load already-measured rows into `bench-results/`? |

## Layout convention

Every experiment folder follows one of three shapes:

**Lab**
```
<name>/
  experiment.ts   # CLI + runEuroExperiment / runLabSession
  definition.ts   # LabDefinition (methodology, profiles, scenarios)
  profiles.ts     # app URL, block patterns, profile builders (optional if tiny)
```

**Runtime**
```
<name>/
  experiment.ts   # stack setup + CLI
  run.ts          # CDP capture/replay checks
```

**Import**
```
<name>/
  experiment.ts     # CLI
  measurements.ts   # raw rows (profile × replicate × metrics)
  publish.ts        # build observations, reports, Jira export
```

## npm scripts

| Script | Experiment |
|--------|------------|
| `npm run bench:euro` | `lab/euro-cwv-lab` |
| `npm run bench:euro:menu` | `lab/euro-menu-lab` |
| `npm run bench:seed-euro-paths` | `import/euro-seed-paths` |
| `npm run bench:seed-euro-menu` | `import/euro-seed-menu` (deprecated) |

Generic lab runs use `npm run bench` with `src/config.example.ts`.

## Output

Lab and import experiments write to:

```text
bench-results/observations/<sessionId>/
bench-results/summary/<sessionId>/report.json
bench-results/summary/<sessionId>/report.tsv
```

Import experiments may also write human exports under `bench-results/euro-paths/<date>/`.

Runtime experiments print pass/fail to the terminal; they do not produce lab reports unless you add that separately.

## Adding a new experiment

1. Pick the type (lab / runtime / import).
2. Create `src/experiments/<type>/<short-name>/` using the file layout above.
3. Wire an npm script in `package.json` if it should be a one-liner to run.
4. Document it in the README for that type.
