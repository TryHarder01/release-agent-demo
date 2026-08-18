---
name: on-call-service-triage
description: Investigate FleetNet Cloud Run sluggishness or health reports with read-only Cloud Monitoring, Cloud Logging, and two bounded synthetic probes. Use when an SRE asks about a deployed revision's live health or performance.
---

# FleetNet on-call service triage

Investigate a reported live-service problem. This is not a release gate and
does not decide whether a candidate can be promoted.

## Default incident target

Start every investigation with the FleetNet production defaults. Do not ask a
question before collecting this first-pass evidence:

```bash
PROJECT=warpdemo-505821
REGION=northamerica-northeast1
SERVICE=fleetnet-route-planner
TARGET_URL=https://fleetnet-route-planner-majbcfnhwq-nn.a.run.app
WINDOW=last 60 minutes ending when the investigation starts
```

The SRE can override the revision, UTC window, or target URL. If they name a
revision, focus the log analysis and summary on that revision while retaining a
service-wide comparison. If they name no revision, discover the revisions that
received traffic in the default window from Cloud Monitoring and report each
one with traffic.

## Safety and credentials

The `GCP_SA_KEY` secret authenticates the read-only
`fleetnet-grafana@warpdemo-505821.iam.gserviceaccount.com` identity. Write it
to a temporary file with restrictive permissions, activate it with `gcloud auth
activate-service-account`, and delete it through a shell cleanup trap. Never
print the secret, token, temporary-file path, or credential file contents.

Use only read-only GCP operations: `gcloud auth activate-service-account`,
`gcloud auth list`, `gcloud auth print-access-token`, `gcloud logging read`,
and `gcloud run revisions describe`. Call Google Cloud Monitoring with an
authenticated `GET`. Do not deploy, promote, update IAM, alter Cloud Run, or
change repository files.

Do not call `POST /metrics/reset`. Do not run a load test. The allowed active
checks are one health request and two sequential route requests described in
this skill.

## Collect evidence

First, check `GET <target-url>/health`; record its status, version, image tag, and
   uptime. Treat a failed health check as evidence, not a reason to stop
   collecting read-only telemetry.

Next, query the Prometheus-compatible Cloud Monitoring endpoint for the specified
   window. Report service and revision values for request count, 5xx rate, p50,
   p95, p99, and instance count when present. Use
   `run.googleapis.com/request_count`,
   `run.googleapis.com/request_latencies_bucket`, and
   `run.googleapis.com/container/instance_count`, grouping revision results by
   `revision_name`.

Then query Cloud Logging for every active revision in the incident window.
   Narrow the query to a named revision when the SRE provides one. Project
   fields rather than returning raw envelopes:

   ```bash
   gcloud logging read '
     resource.type="cloud_run_revision"
     resource.labels.service_name="fleetnet-route-planner"
     resource.labels.revision_name="REVISION_NAME"
     jsonPayload.event="route_calculated"
   ' --project="$PROJECT" --format='csv(timestamp,jsonPayload.lane,jsonPayload.status,jsonPayload.duration_ms)'
   ```

   Also query `route_rejected`, `route_failed`, and `client_error`. Report raw
   counts and the useful projected values, including missing client-error
   messages when present.

Finally, send two sequential `POST <target-url>/api/route` requests. Measure
   end-to-end client latency and record HTTP status and route status:

   ```json
   {"origin":"Denver","destination":"Salt Lake City","vehicle_type":"van","service_level":"standard"}
   ```

   ```json
   {"origin":"Miami","destination":"Minneapolis","vehicle_type":"van","service_level":"standard"}
   ```

   The first covers the normal optimized path. The second deterministically
   covers `requires_relay`. Mark both as agent-generated traffic in the report.

## Interpret the signals

- Cloud Run latency is edge-to-edge and includes every path. It is not the
  release gate's in-process `POST /api/route` p95.
- `route_calculated.duration_ms` measures route-engine work only. It excludes
  the configurable upstream delay before the calculation. High Cloud Run or
  synthetic latency with low route duration can indicate time outside the
  route engine.
- Compare the target revision with other revisions that received traffic in the
  same window. Do not call a difference a regression when traffic is absent or
  the comparison is not like-for-like.
- Cloud Logging can lag by roughly 10-15 seconds. If the window includes a
  recently issued synthetic request, state that its absence from logs is pending
  ingestion, not evidence of no request.
- If a permission or query fails, identify the missing capability and label
  that evidence unavailable. Never work around the restriction.

## Report

Return a short report with these headings:

1. `Assessment` — healthy, suspicious, or inconclusive
2. `User impact` — errors, latency, and affected route profiles supported by
   the evidence
3. `Evidence` — incident target, exact queries, raw values, and synthetic
   probe results
4. `Recommendation` — a specific human next action and confidence
5. `Limits` — missing data, permissions, delayed logs, or attribution limits

State observations separately from inferences. Do not claim a cause unless at
least two independent signals support it.
