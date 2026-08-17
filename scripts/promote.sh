#!/usr/bin/env bash
#
# Promote the verified candidate revision to 100% of production traffic.
# This is the action a release agent takes only after a PROMOTE verdict.
#
#   ./scripts/promote.sh
#
# To roll back instead, pass a known-good revision:
#   ./scripts/promote.sh vantage-route-planner-00007-abc

set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-warpdemo-505821}"
GCP_REGION="${GCP_REGION:-northamerica-northeast1}"
SERVICE="${SERVICE:-vantage-route-planner}"
TARGET_REVISION="${1:-}"

if [[ -n "${TARGET_REVISION}" ]]; then
  echo "==> Rolling traffic to revision ${TARGET_REVISION}"
  gcloud run services update-traffic "${SERVICE}" \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --to-revisions "${TARGET_REVISION}=100" \
    --quiet
else
  echo "==> Promoting latest revision to 100% traffic"
  gcloud run services update-traffic "${SERVICE}" \
    --project "${GCP_PROJECT}" \
    --region "${GCP_REGION}" \
    --to-latest \
    --quiet
fi

gcloud run services describe "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --format='table(status.traffic.revisionName, status.traffic.percent, status.traffic.tag)'
