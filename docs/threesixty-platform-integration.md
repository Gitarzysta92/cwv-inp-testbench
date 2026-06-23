# Threesixty Platform Integration

This repository is intended to be onboarded as an external GitOps-first
solution through the threesixty-platform GitHub App flow. It should not be
committed into the platform repository as a built-in solution.

## Onboarding contract

The customer-authored entry point is the solution environment manifest:

```text
.platform/cwv-test-bench.environment.yaml
```

The onboarding request should pass that path as `environmentManifestPath`:

```json
{
  "solutionId": "cwv-test-bench",
  "solutionName": "CWV Test Bench",
  "repoUrl": "https://github.com/Gitarzysta92/cwv-inp-testbench.git",
  "provider": "github",
  "installationId": "<github-app-installation-id>",
  "targetRevision": "main",
  "environmentManifestPath": ".platform/cwv-test-bench.environment.yaml"
}
```

Do not hand-author `PlatformIntegrationClaim`, parent Argo CD `Application`, or
AppProject resources in this repository. The platform should validate the
environment manifest and derive those admission/runtime objects internally.

The environment manifest selects these declarations:

| Ref | Declaration |
| --- | --- |
| `cwv-test-bench-runner` | Direct workload manifests in `manifests/cwv-test-bench-runner`; image override comes from `variables.imageTag` |
| `opensearch-index` | Inline OpenSearch index claim under `spec.manifests.resourceClaims` |

There is intentionally no hand-authored `SolutionDefinition` file in this
repository. The updated platform onboarding docs make the environment manifest
the customer-owned contract; lower-level declaration resolution and rendered
Argo CD wiring belong to the platform onboarding/rendering flow.

## OpenSearch assumption

The platform does not currently expose a committed OpenSearch claim reconciler
in this repository. This solution assumes the platform will provide a
solution-facing environment claim surface equivalent to:

```yaml
apiVersion: platform.search/v1alpha1
kind: OpenSearchIndexAccessClaim
```

The environment manifest requests writer access to the `cwv-bench-runs` index
and asks the platform to materialize this Secret in the solution namespace:

```text
name: cwv-test-bench-opensearch-writer
namespace: cwv-test-bench-solution
```

with keys:

```text
username
password
```

The runner CronJob remains suspended by default and expects that secret before
an ad-hoc run is created. Keep it suspended until the OpenSearch claim reports
Ready and the writer Secret has been materialized.

## Environment strategy

The default onboarding entry point remains:

```text
.platform/cwv-test-bench.environment.yaml
```

For now, treat that as the single canonical CWV bench environment. Additional
environments should be created only when they answer a concrete operational
need:

| Environment type | Purpose | Notes |
| --- | --- | --- |
| `dev` or ad-hoc | Validate manifest, image, and OpenSearch writer contract | Keep CronJob suspended; run Jobs manually with low replicate counts. |
| `prod` or scheduled | Stable benchmark cadence and reporting | Use an immutable image tag or digest before enabling schedule. |
| ephemeral | Short-lived branch or PR validation | Create only if the platform has cleanup/offboarding and isolated index naming. |

Each environment should be spawned through the GitHub App onboarding flow by
passing the desired `environmentManifestPath` and target revision. Do not add
hand-authored `PlatformIntegrationClaim`, parent Argo CD `Application`, or
AppProject files for extra environments.

## Runtime

The workload uses the container image:

```text
ghcr.io/gitarzysta92/cwv-inp-testbench:${imageTag}
```

The GitHub Actions workflow publishes:

```text
ghcr.io/gitarzysta92/cwv-inp-testbench:sha-<commit-sha>
ghcr.io/gitarzysta92/cwv-inp-testbench:latest
```

Use `latest` only for early integration. Set `variables.imageTag` to an
immutable `sha-<commit-sha>` tag before production runs.

It runs:

```bash
npm run bench:runtime:euro:menu:local-headless
```

with:

```text
BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked
BENCH_REPLICATES=3
BENCH_OPENSEARCH_INDEX=cwv-bench-runs
```

Raw files are still written under `/app/bench-results` on the runner PVC, while
session, summary, and observation documents are also published to OpenSearch.

## Image build and publish

The packed runner image is built by:

```text
.github/workflows/cwv-test-bench-image.yaml
```

The workflow runs the required checks, builds `Dockerfile`, and pushes to GHCR
using the repository `GITHUB_TOKEN` with `packages: write` permission.
