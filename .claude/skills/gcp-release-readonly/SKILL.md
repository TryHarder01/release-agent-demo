---
name: gcp-release-readonly
description: Inspect the FleetNet GCP release setup with gcloud using read-only commands only. Use when checking Cloud Run service, revision, traffic, Artifact Registry image, IAM/WIF, project, or enabled-service state for the release-agent demo, or when diagnosing its GCP delivery pipeline without changing cloud resources.
---

# FleetNet GCP read-only inspection

Use this skill to observe the demo environment. Never run a mutating command,
including `create`, `delete`, `deploy`, `update`, `set`, `enable`, `add-iam-policy-binding`,
or `gcloud config set`. Do not invoke `gh` commands that write state.

## Constants

```bash
PROJECT=warpdemo-505821
REGION=northamerica-northeast1
SERVICE=fleetnet-route-planner
REPOSITORY=warpdemo
IMAGE=northamerica-northeast1-docker.pkg.dev/warpdemo-505821/warpdemo/fleetnet-route-planner
SA_EMAIL=warpdemogha@warpdemo-505821.iam.gserviceaccount.com
```

Pass `--project="$PROJECT"` and `--region="$REGION"` explicitly. This avoids
depending on, or changing, the active local gcloud configuration.

## Inspect a release

```bash
# Current service URL, traffic split, and tagged candidate URL
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='yaml(status.url,status.latestReadyRevisionName,status.traffic)'

# Revision history, image digest, readiness, and creation time
gcloud run revisions list --service="$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='table(metadata.name,status.conditions[0].status,metadata.creationTimestamp,spec.containers[0].image)'

# Details for one known revision
gcloud run revisions describe REVISION --project="$PROJECT" --region="$REGION" \
  --format='yaml(metadata.name,metadata.creationTimestamp,spec.containers,status.conditions)'
```

Interpretation: the production URL is `status.url`; the `candidate` traffic
entry has its own URL and should remain at 0% until verification returns
`PROMOTE`. The production revision is the entry with nonzero `percent`.

## Inspect the image artifact

```bash
# Repository and images available in the regional registry
gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" --project="$PROJECT"
gcloud artifacts docker images list "$IMAGE" --include-tags --project="$PROJECT"

# Tags and immutable digest for a particular image path
gcloud artifacts docker tags list "$IMAGE" --project="$PROJECT" \
  --format='table(tag,version,updateTime)'
```

`git-<full-commit-sha>` identifies the CI-built artifact. `latest` is only a
moving convenience pointer. Cloud Run resolves the selected image at deployment;
compare the revision container image digest to the registry digest and never
infer a deployed revision from `latest` alone.

## Inspect identity and configuration

```bash
gcloud projects describe "$PROJECT" --format='yaml(projectId,projectNumber,name)'
gcloud services list --enabled --project="$PROJECT" \
  --filter='config.name:(run.googleapis.com OR artifactregistry.googleapis.com OR iamcredentials.googleapis.com OR sts.googleapis.com)'
gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT"
gcloud projects get-iam-policy "$PROJECT" --flatten='bindings[].members' \
  --filter="bindings.members:serviceAccount:$SA_EMAIL" --format='table(bindings.role)'
gcloud iam workload-identity-pools providers describe github --location=global \
  --workload-identity-pool=github --project="$PROJECT" \
  --format='yaml(name,state,oidc,attributeMapping,attributeCondition)'
```

The WIF provider must restrict `attribute.repository` to
`TryHarder01/release-agent-demo`. The GitHub OIDC token exchange itself can be
proven only from a GitHub Actions runner.

## Report findings

State the exact project, region, service, revision, image digest/tag, and
traffic percentages observed. Separate facts from inference, and call out any
command that failed because the caller lacks read permission.
