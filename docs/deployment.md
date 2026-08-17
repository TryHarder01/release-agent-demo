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

For deploying by hand:

```bash
export GCP_PROJECT=warpdemo-505821
export GCP_REGION=northamerica-northeast1

gcloud auth login
gcloud config set project "$GCP_PROJECT"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

The identity CI uses is a separate concern — service account, IAM roles,
Workload Identity Federation, and the registry are all in
[gcp-setup.md](gcp-setup.md).

CI builds the container once and pushes it to Artifact Registry. `deploy.sh`
deploys that existing image; it never rebuilds source during release. It derives
a `git-<short-sha>` Cloud Run revision suffix from the immutable
`git-<full-sha>` image tag. The same short SHA is surfaced in `/health` and the
FleetNet header, so Grafana's `revision_name` maps visibly back to the image.

## Deploy a candidate

```bash
export GCP_PROJECT=warpdemo-505821
export IMAGE_REF=northamerica-northeast1-docker.pkg.dev/warpdemo-505821/warpdemo/fleetnet-route-planner:git-<full-commit-sha>
./scripts/deploy.sh
```

This deploys at **0% traffic** with the tag `candidate` and prints two URLs:

- `candidate url` — the revision under test, e.g. `https://candidate---fleetnet-route-planner-xxxx.run.app`
- `production url` — the stable service URL serving live traffic

## Verify, then promote

```bash
BASE_URL=<candidate url> npm run verify   # 0 = PROMOTE, 1 = STOP, 2 = NEEDS_REVIEW
./scripts/promote.sh <candidate-revision> # only after a PROMOTE verdict
```

Rollback to a specific revision:

```bash
./scripts/promote.sh fleetnet-route-planner-00007-abc
gcloud run revisions list --service fleetnet-route-planner --region "$GCP_REGION"
```

## CI

`.github/workflows/release.yml` runs deploy → verify → (optional) promote. It
authenticates with Workload Identity Federation — no service account key. See
[gcp-setup.md](gcp-setup.md) to build that identity from scratch; the values it
needs are:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `GCP_PROJECT` | `warpdemo-505821` |
| Variable | `GCP_REGION` | e.g. `northamerica-northeast1` |
| Secret | `GCP_WIF_PROVIDER` | `projects/638332938882/locations/global/workloadIdentityPools/github/providers/github` |
| Secret | `GCP_SERVICE_ACCOUNT` | `warpdemogha@warpdemo-505821.iam.gserviceaccount.com` |

The GitHub Actions service account needs `roles/run.admin`,
`roles/artifactregistry.writer`, and `roles/iam.serviceAccountUser`.

`ci.yml`'s `push` job uses the same two secrets to publish the merged image to
Artifact Registry on every push to `main`:

```
northamerica-northeast1-docker.pkg.dev/warpdemo-505821/warpdemo/fleetnet-route-planner
```

Tagged `git-<full-commit-sha>` and `latest`, built for `linux/amd64`, with the
layer cache in GitHub Actions. No semver — the commit SHA is the immutable
artifact identity. It runs only after the test job passes, and only on `main` —
pull requests build the image but never push it.

That image is not yet a release. `release.yml` deploys the matching
`git-<full-commit-sha>` image at 0% traffic, verifies that candidate revision,
and only then shifts traffic to that exact revision. The image CI built is the
image the release gate verifies.

Create the repo once if it does not exist:

```bash
gcloud artifacts repositories create warpdemo \
  --repository-format=docker \
  --location=northamerica-northeast1 \
  --project=warpdemo-505821
```

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
