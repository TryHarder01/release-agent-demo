# Local Grafana over Cloud Run metrics

A dashboard for the release-agent demo, built on **Cloud Run's built-in metrics**.
Nothing is instrumented in the app for this — Cloud Run writes `request_count`,
`request_latencies`, and `instance_count` to Cloud Monitoring automatically, and
Cloud Monitoring exposes them over a Prometheus-compatible API.

```bash
cd grafana && docker compose up -d
open http://localhost:3000        # anonymous viewer; admin/admin to edit
```

## Shape

```
Cloud Run  ──(automatic)──>  Cloud Monitoring
                                    │  PromQL API
                             gmp-frontend :9090   ← handles Google auth
                                    │  plain Prometheus HTTP API
                                 Grafana :3000
```

The proxy exists so Grafana holds an ordinary **Prometheus** datasource. The
dashboard's queries are therefore portable PromQL — the same JSON runs against
any Prometheus, which matters when the target environment is somebody else's
Grafana.

Port 9090 is published, so the release agent can hit the identical API:

```bash
curl -s -G http://localhost:9090/api/v1/query --data-urlencode \
  'query=histogram_quantile(0.95, sum by (revision_name, le) (rate({__name__="run.googleapis.com/request_latencies_bucket", service_name="fleetnet-route-planner"}[10m])))'
```

Metric names carry dots and slashes, so they go in a `{__name__="..."}` selector
rather than a bare identifier.

## Credentials

`fleetnet-grafana@warpdemo-505821.iam.gserviceaccount.com`, holding
`roles/monitoring.viewer` and nothing else. Deliberately not the deploy identity:
a read-only dashboard should not hold a key that can deploy to Cloud Run.

The key lives at `grafana/gcp-key.json` and the path is set in `grafana/.env`.
Both are gitignored. To recreate:

```bash
gcloud iam service-accounts keys create grafana/gcp-key.json \
  --iam-account=fleetnet-grafana@warpdemo-505821.iam.gserviceaccount.com
```

## What's on it

**Service health** — request rate, 5xx rate, p95, instance count, plus requests
by response class and the latency percentile band. This is an ordinary service
dashboard, and it is deliberately ordinary: under regression A it stays entirely
green while the product is broken.

**Release context** — p95 broken out by `revision_name`, with the gate's 750 ms
budget drawn as a dashed line, and a table comparing every revision's p95, request
count, and error rate. `scripts/deploy.sh` already writes `candidate_revision` to
`GITHUB_OUTPUT`, so this row is the candidate-vs-serving comparison the release
brief cites. It is independent corroborating evidence for the brief, not a
current input to the gate or a substitute for Oz's bounded release decision.

## Two things not to confuse

**This is not the gate's number.** Cloud Run measures edge-to-edge latency across
every path, static assets included. The gate reads in-process per-route timings
from `/metrics` during a controlled 40-request run. Both are correct; they answer
different questions, and the brief should never compare them as if they were one
metric.

**This is not a second gate.** The dashboard gives Oz and the human approver
continuous, per-revision context. `scripts/verify-release.mjs` remains the
policy authority until correlated GMP metrics are deliberately added to the
agent's evidence model.

## Optional app-level metrics

`GET /metrics/prometheus` exposes bounded dispatch-profile metrics for a busier
observability view: route calculations, planned miles, planned driving minutes,
rolling route-latency percentiles, and configured delay. The dimensions are
`vehicle_type`, `distance_band`, `traffic_band`, and route `status`; lane names
are intentionally excluded to prevent unbounded metric cardinality.

The current local Grafana datasource deliberately reads Cloud Run's built-in
metrics only. These app-level metrics are direct candidate evidence for the
agent and are not an excuse to add a sidecar or another deploy component to the
demo. If the deployment model changes later, `/metrics/prometheus` is ready for
a standard scrape configuration; until then, Grafana must not imply it has this
data.

**There is no path label.** Cloud Run's metrics are per-revision, not per-endpoint,
so `POST /api/route` cannot be isolated from bundle serving. A 2.5 s handler delay
still dominates and shows clearly; finer attribution is what a Prometheus sidecar
would buy, and it isn't needed yet.
