---
name: diagnose-release-performance
description: Diagnose FleetNet Cloud Run candidate performance after release verification by cross-referencing Cloud Monitoring and Cloud Logging directly, without Grafana. Use only for a NEEDS_REVIEW verdict, a suspected release-gate sampling blind spot, or an explanation of a candidate revision's latency/errors beyond the boolean gate. For any other bug or behavior investigation, use `investigate`.
---

# Diagnose release performance

This is not the release gate. `scripts/verify-release.mjs` remains the sole
policy authority — its thresholds are correct and this skill never overrides
them. This skill is for the question the gate structurally can't answer: *why*
does the evidence look the way it does, and does the gate's own sampling
design cover what actually changed. Read `docs/regressions.md`'s Regression C
before using this on a real investigation — it's the concrete case this skill
exists for.

Use `investigate` for any ordinary bug, unexpected behavior, or code-path
trace. This skill is deliberately narrower: an already-deployed FleetNet
candidate, its release result, and Cloud Run performance evidence.

Never run a mutating command. Read-only: `gcloud logging read`, `gcloud run
revisions describe`, and plain `curl -sG` (with a `gcloud auth
print-access-token` bearer token) against the Prometheus-compatible query
endpoint — there's no dedicated `gcloud monitoring query` command for this
API, `curl` is the real interface.

## Constants

```bash
PROJECT=warpdemo-505821
REGION=northamerica-northeast1
SERVICE=fleetnet-route-planner
```

## Prerequisite — check this first, don't assume it

Reading logs needs `roles/logging.viewer`; reading metrics needs
`roles/monitoring.viewer`. Both are granted today to
`fleetnet-grafana@warpdemo-505821.iam.gserviceaccount.com` (see
`grafana/README.md`) — that's the identity to authenticate as for both query
types below. Verify rather than assume, since IAM state drifts:

```bash
gcloud projects get-iam-policy "$PROJECT" --flatten='bindings[].members' \
  --filter='bindings.members:serviceAccount:fleetnet-grafana@warpdemo-505821.iam.gserviceaccount.com' \
  --format='table(bindings.role)'
```

If either role is missing, report the gap rather than working around it —
granting IAM roles is a mutating command outside this skill's scope.

## Metrics — Cloud Monitoring, direct

No Grafana, no local `gmp-frontend` proxy. Query the same data Grafana would
show, straight from Google's global Prometheus-compatible endpoint:

```bash
TOKEN=$(gcloud auth print-access-token)

curl -sG "https://monitoring.googleapis.com/v1/projects/${PROJECT}/location/global/prometheus/api/v1/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  --data-urlencode 'query=histogram_quantile(0.95, sum by (revision_name, le) (rate({__name__="run.googleapis.com/request_latencies_bucket", service_name="'"$SERVICE"'"}[10m])))'
```

This is per-revision, edge-to-edge latency across every path (static assets
included) — not the same number as the gate's in-process `/metrics` p95. Both
are correct; they answer different questions (`grafana/README.md`, "Two
things not to confuse"). Use this for the aggregate: is the candidate revision
worse than the serving one, broadly.

## Before trusting an empty log result

An empty `route_calculated`/`client_error` query has two causes that look
identical and aren't: no matching traffic, or the deployed image predates the
field you're filtering on. Confirmed live — a candidate revision created one
minute before the commit that added `duration_ms` and `/client-error`
returned an empty result for both, and a direct request to `/client-error`
404'd. Check the revision's age against the code before concluding "no
evidence":

```bash
gcloud run revisions describe REVISION_NAME --project="$PROJECT" --region="$REGION" \
  --format='value(metadata.creationTimestamp)'
# compare against: git log -1 --format=%cI <commit that added the field>
```

If the revision predates the field, that's the finding — report it as a stale
image, not as an absence of the condition you were checking for.

## Logs — Cloud Logging, direct

Project fields instead of pulling raw JSON. Measured on this project: the same
4-entry query is 3,923 bytes as `--format=json` versus 282 bytes projected —
14x smaller, no tool beyond `gcloud` itself. All the bloat is Cloud Logging's
own envelope (`insertId`, `labels.instanceId`, `receiveTimestamp`, repeated
`resource.labels`), none of which the app controls or a query needs.

```bash
# Route calculations with timing, for a given revision
gcloud logging read '
  resource.type="cloud_run_revision"
  resource.labels.service_name="'"$SERVICE"'"
  resource.labels.revision_name="REVISION_NAME"
  jsonPayload.event="route_calculated"
' --project="$PROJECT" --freshness=1d \
  --format='csv(timestamp,jsonPayload.lane,jsonPayload.status,jsonPayload.duration_ms)'

# Client-side failures — did real requests actually break, or just run slow
gcloud logging read '
  resource.type="cloud_run_revision"
  resource.labels.service_name="'"$SERVICE"'"
  resource.labels.revision_name="REVISION_NAME"
  jsonPayload.event="client_error"
' --project="$PROJECT" --freshness=1d \
  --format='csv(timestamp,jsonPayload.message)'
```

Drop to `--format=json` only if a field genuinely needs full structure —
projection is the default, not raw JSON.

Log ingestion isn't instant — a request made just now may take on the order of
10-15 seconds to become queryable. Don't read a query run immediately after
triggering traffic as authoritative; wait or re-query.

`route_calculated` entries carry `lane`, `status`, and `duration_ms`
(`server/src/app.js`) — this is the per-request signal the aggregate metric
can't give you: *which* lanes are slow, not just that the revision is. Filter
`jsonPayload.status="requires_relay"` to check the exact blind spot Regression
C describes.

## Synthesis — the actual job

Boolean checks don't need this skill; they're already `scripts/verify-release.mjs`'s
job. Use this once, after the gate has already run, to answer what the gate
can't:

1. Does the diff touch a code path gated on something outside the release
   gate's fixed `LANES` sample (`scripts/verify-release.mjs`) — e.g. a
   `status`, `vehicle_type`, or `distance_band` value none of the four lanes
   ever produce?
2. If so, query logs filtered to that condition. Are `duration_ms` values
   elevated versus the same filter on the previous (serving) revision?
3. Query `client_error` for the same revision and window. Elevated duration
   with zero client errors is the Regression C shape — slow, not broken.
   Elevated duration with elevated client errors is closer to Regression A —
   something is actually failing, not just slow.
4. State the aggregate Cloud Monitoring p95 alongside the per-lane finding.
   A quiet aggregate does not contradict a real per-lane regression — it
   often means the affected lanes are a small share of the gate's or
   production's traffic mix, which is itself worth saying explicitly.

## Report findings

State the exact revision name, the log/metric queries run, and the raw
counts or values returned — not a paraphrase. Separate what the data shows
from what you're inferring about the diff. If a query fails for permissions,
say so and name the missing role; do not report an absence of evidence as
evidence of absence.
