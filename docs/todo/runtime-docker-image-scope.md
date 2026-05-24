# Runtime Docker Image Scope

## Problem

The runtime Dockerfile currently copies the whole `src` tree into the image:

```dockerfile
COPY src ./src
```

That makes experiment, orchestrator, lab, and scenario edits invalidate the runtime image layer, even when runtime code did not change.

## Target Design

The runtime image should contain only runtime-owned code and minimal shared contracts:

- `src/runtime`
- runtime API contracts
- profile/network types needed by runtime
- minimal shared helpers required by runtime imports

Experiment, orchestrator, lab aggregation, and scenario code should stay host-side and should not trigger a runtime image rebuild.

## Proposed Work

1. Audit runtime imports and identify non-runtime dependencies.
2. Move shared contracts out of `src/lab` into a neutral module, for example `src/contracts`.
3. Update runtime imports to depend only on runtime code plus contracts.
4. Narrow the Dockerfile copy surface.
5. Add a build/check that prevents runtime from importing experiments, orchestrator, clients, or lab implementation modules.

## Expected Outcome

Changing experiment definitions or lab methodology should not rebuild the runtime Docker image. Runtime image rebuilds should happen only for runtime code, runtime dependencies, or shared contract changes.
