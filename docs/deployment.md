# Deployment (Cloud Run)

The app ships as a **single container**: Express serves the API and the built
React bundle from one process, so there is one service and one stable URL.

## Why single-service still demonstrates a release gate

Cloud Run's promote/rollback primitives live at the **revision** level, not the
service level. That is enough for the whole demo:

```
deploy --no-traffic --tag candidate   ->  candidate gets its own stable URL,
                                          production keeps serving the old revision
verify against the candidate URL      ->  Playwright + health + latency + errors
update-traffic --to-latest            ->  PROMOTE
(do nothing)                          ->  STOP; candidate sits at 0% traffic
update-traffic --to-revisions X=100   ->  rollback
```

A bad candidate never receives user traffic, which is what makes the verdict
meaningful rather than cosmetic.

## One-time GCP setup

```bash
export GCP_PROJECT=your-project-id
export GCP_REGION=us-central1

gcloud auth login
gcloud config set project "$GCP_PROJECT"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

`deploy.sh` uses `gcloud run deploy --source .`, which hands the Dockerfile to
Cloud Build — no local Docker or registry wrangling needed.

## Deploy a candidate

```bash
export GCP_PROJECT=your-project-id
./scripts/deploy.sh
```

This deploys at **0% traffic** with the tag `candidate` and prints two URLs:

- `candidate url` — the revision under test, e.g. `https://candidate---vantage-route-planner-xxxx.run.app`
- `production url` — the stable service URL serving live traffic

## Verify, then promote

```bash
BASE_URL=<candidate url> npm run verify   # 0 = PROMOTE, 1 = STOP, 2 = NEEDS_REVIEW
./scripts/promote.sh                      # only after a PROMOTE verdict
```

Rollback to a specific revision:

```bash
./scripts/promote.sh vantage-route-planner-00007-abc
gcloud run revisions list --service vantage-route-planner --region "$GCP_REGION"
```

## CI

`.github/workflows/release.yml` runs deploy → verify → (optional) promote. It
needs Workload Identity Federation:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `GCP_PROJECT` | your project id |
| Variable | `GCP_REGION` | e.g. `us-central1` |
| Secret | `GCP_WIF_PROVIDER` | `projects/N/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
| Secret | `GCP_SERVICE_ACCOUNT` | `deployer@PROJECT.iam.gserviceaccount.com` |

The deploying service account needs `roles/run.admin`,
`roles/cloudbuild.builds.editor`, `roles/artifactregistry.writer`, and
`roles/iam.serviceAccountUser`.

Trigger it:

```bash
gh workflow run release.yml                          # healthy deploy
gh workflow run release.yml -f route_delay_ms=2500   # latency regression
gh workflow run release.yml -f auto_promote=true     # promote if verification passes
```

The job fails when the verdict is not `PROMOTE`, and the candidate is left at
0% traffic.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Injected by Cloud Run |
| `RELEASE_VERSION` | `dev` | Surfaced on `/health`, `/metrics`, and in the UI |
| `ROUTE_DELAY_MS` | `0` | Simulated upstream latency — see [regressions.md](regressions.md) |

## No GCP handy?

`./scripts/verify-local.sh` runs the identical verification sequence against a
local container. Everything except `gcloud` is exercised.
