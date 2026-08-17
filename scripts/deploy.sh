#!/usr/bin/env bash
#
# Deploy a candidate revision to Cloud Run WITHOUT sending it production traffic.
#
#   ./scripts/deploy.sh
#
# The revision gets its own stable tagged URL, which is what Playwright and the
# release verifier run against. Production keeps serving the previous revision
# until scripts/promote.sh is run.
#
# Env:
#   GCP_PROJECT     default warpdemo-505821
#   GCP_REGION      default northamerica-northeast1
#   SERVICE         default vantage-route-planner
#   CANDIDATE_TAG   default candidate
#   ROUTE_DELAY_MS  default 0 — set to 2500 to simulate the latency regression

set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-warpdemo-505821}"
GCP_REGION="${GCP_REGION:-northamerica-northeast1}"
SERVICE="${SERVICE:-vantage-route-planner}"
CANDIDATE_TAG="${CANDIDATE_TAG:-candidate}"
ROUTE_DELAY_MS="${ROUTE_DELAY_MS:-0}"
RELEASE_VERSION="${RELEASE_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo dev)}"

echo "==> Deploying candidate"
echo "    project=${GCP_PROJECT} region=${GCP_REGION} service=${SERVICE}"
echo "    version=${RELEASE_VERSION} route_delay_ms=${ROUTE_DELAY_MS}"

gcloud run deploy "${SERVICE}" \
  --source . \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 1 \
  --max-instances 4 \
  --set-env-vars "RELEASE_VERSION=${RELEASE_VERSION},ROUTE_DELAY_MS=${ROUTE_DELAY_MS}" \
  --tag "${CANDIDATE_TAG}" \
  --no-traffic \
  --quiet

CANDIDATE_URL="$(gcloud run services describe "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --format="value(status.traffic.filter(\"tag:${CANDIDATE_TAG}\").extract(url))" | tr -d '[]')"

PROD_URL="$(gcloud run services describe "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

echo ""
echo "==> Candidate deployed (0% traffic)"
echo "    candidate url : ${CANDIDATE_URL}"
echo "    production url: ${PROD_URL}"
echo ""
echo "Next: BASE_URL=${CANDIDATE_URL} npm run verify"

# Expose for CI steps.
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "candidate_url=${CANDIDATE_URL}"
    echo "production_url=${PROD_URL}"
  } >>"${GITHUB_OUTPUT}"
fi
