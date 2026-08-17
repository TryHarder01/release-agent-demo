#!/usr/bin/env bash
#
# Deploy a candidate revision to Cloud Run WITHOUT sending it production traffic.
#
#   IMAGE_REF=northamerica-northeast1-docker.pkg.dev/warpdemo-505821/warpdemo/fleetnet-route-planner:git-<commit-sha> ./scripts/deploy.sh
#
# The revision gets its own stable tagged URL, which is what Playwright and the
# release verifier run against. Production keeps serving the previous revision
# until scripts/promote.sh is run.
#
# Env:
#   GCP_PROJECT     default warpdemo-505821
#   GCP_REGION      default northamerica-northeast1
#   SERVICE         default fleetnet-route-planner
#   CANDIDATE_TAG   default candidate
#   IMAGE_REF       required — immutable CI-built `git-<full-sha>` image tag
#   ROUTE_DELAY_MS  default 0 — set to 2500 to simulate the latency regression

set -euo pipefail

GCP_PROJECT="${GCP_PROJECT:-warpdemo-505821}"
GCP_REGION="${GCP_REGION:-northamerica-northeast1}"
SERVICE="${SERVICE:-fleetnet-route-planner}"
CANDIDATE_TAG="${CANDIDATE_TAG:-candidate}"
ROUTE_DELAY_MS="${ROUTE_DELAY_MS:-0}"
RELEASE_VERSION="${RELEASE_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo dev)}"
IMAGE_REF="${IMAGE_REF:?IMAGE_REF must identify the CI-built Artifact Registry image to deploy}"
IMAGE_TAG="${IMAGE_REF##*:}"

# The image tag is the immutable identity. Carry its short SHA through Cloud
# Run's revision name, the app's health response, and the UI so a Grafana row
# can be read back to the deployed image without an external lookup.
if [[ "${IMAGE_TAG}" =~ ^git-([0-9a-f]{7,40})$ ]]; then
  RELEASE_ID="${BASH_REMATCH[1]:0:7}"
else
  echo "IMAGE_REF must use the immutable git-<full-sha> tag; got ${IMAGE_REF}" >&2
  exit 2
fi
REVISION_SUFFIX="git-${RELEASE_ID}"

echo "==> Deploying candidate"
echo "    project=${GCP_PROJECT} region=${GCP_REGION} service=${SERVICE}"
echo "    release_id=${RELEASE_ID} image_tag=${IMAGE_TAG} route_delay_ms=${ROUTE_DELAY_MS}"
echo "    image=${IMAGE_REF}"

gcloud run deploy "${SERVICE}" \
  --image "${IMAGE_REF}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 1 \
  --max-instances 4 \
  --revision-suffix "${REVISION_SUFFIX}" \
  --set-env-vars "RELEASE_VERSION=${RELEASE_ID},IMAGE_TAG=${IMAGE_TAG},ROUTE_DELAY_MS=${ROUTE_DELAY_MS}" \
  --tag "${CANDIDATE_TAG}" \
  --no-traffic \
  --quiet

CANDIDATE_URL="$(gcloud run services describe "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --format="value(status.traffic.filter(\"tag:${CANDIDATE_TAG}\").extract(url))" | tr -d "[]'")"
: "${CANDIDATE_URL:?Could not determine the candidate URL}"

PROD_URL="$(gcloud run services describe "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

CANDIDATE_REVISION="$(gcloud run services describe "${SERVICE}" \
  --project "${GCP_PROJECT}" \
  --region "${GCP_REGION}" \
  --format="value(status.traffic.filter(\"tag:${CANDIDATE_TAG}\").extract(revisionName))" | tr -d "[]'")"
: "${CANDIDATE_REVISION:?Could not determine the candidate revision}"

echo ""
echo "==> Candidate deployed (0% traffic)"
echo "    candidate url : ${CANDIDATE_URL}"
echo "    candidate revision: ${CANDIDATE_REVISION}"
echo "    production url: ${PROD_URL}"
echo ""
echo "Next: BASE_URL=${CANDIDATE_URL} npm run verify"

# Expose for CI steps.
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "candidate_url=${CANDIDATE_URL}"
    echo "candidate_revision=${CANDIDATE_REVISION}"
    echo "production_url=${PROD_URL}"
  } >>"${GITHUB_OUTPUT}"
fi
