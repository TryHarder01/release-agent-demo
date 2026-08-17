#!/usr/bin/env bash
#
# Full release rehearsal against a local container — the same sequence CI runs
# against Cloud Run, minus GCP. Builds the image, starts it, runs the release
# verifier, then tears the container down.
#
#   ./scripts/verify-local.sh
#   ROUTE_DELAY_MS=2500 ./scripts/verify-local.sh   # rehearse the latency regression

set -euo pipefail

IMAGE="vantage-route-planner:local"
CONTAINER="vantage-verify-$$"
PORT="${PORT:-8080}"
ROUTE_DELAY_MS="${ROUTE_DELAY_MS:-0}"

cleanup() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building image"
docker build -t "${IMAGE}" .

echo "==> Starting container (ROUTE_DELAY_MS=${ROUTE_DELAY_MS})"
docker run -d --name "${CONTAINER}" \
  -p "${PORT}:8080" \
  -e "ROUTE_DELAY_MS=${ROUTE_DELAY_MS}" \
  -e "RELEASE_VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo local)" \
  "${IMAGE}" >/dev/null

echo "==> Waiting for health"
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "http://localhost:${PORT}/health" >/dev/null || {
  echo "container never became healthy; logs:"
  docker logs "${CONTAINER}"
  exit 1
}

echo "==> Running release verification"
set +e
BASE_URL="http://localhost:${PORT}" node scripts/verify-release.mjs
VERDICT_CODE=$?
set -e

exit "${VERDICT_CODE}"
