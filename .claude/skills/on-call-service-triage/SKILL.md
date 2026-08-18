---
name: on-call-service-triage
description: Investigate FleetNet Cloud Run sluggishness or health reports with read-only Cloud Monitoring, Cloud Logging, and two bounded synthetic probes. Use when an SRE asks about a deployed revision's live health or performance.
---

# FleetNet on-call service triage

Investigate a live-service report. This is not a release gate and does not
decide whether a candidate can be promoted.

## Default target

Start immediately with these defaults. Do not ask a question before collecting
the first-pass evidence:

```bash
PROJECT=warpdemo-505821
REGION=northamerica-northeast1
SERVICE=fleetnet-route-planner
TARGET_URL=https://fleetnet-route-planner-majbcfnhwq-nn.a.run.app
WINDOW=last 60 minutes ending when the investigation starts
```

The SRE can override the revision, UTC window, or target URL. If no revision is
provided, discover revisions with traffic from Cloud Monitoring and compare
them.

## Safety

Authenticate with `GCP_SA_KEY` through a restrictive temporary file and delete
it with a shell cleanup trap. Never print the secret, an access token, or file
contents. Use only read-only GCP operations: `gcloud auth`, `gcloud logging
read`, `gcloud run revisions describe`, and authenticated `GET` requests to the
Cloud Monitoring Prometheus API.

Never deploy, promote, change IAM, alter Cloud Run, modify repository files,
call `POST /metrics/reset`, or generate load.

## Evidence

1. Make one `GET <target-url>/health` request and record status, version, image
   tag, and uptime.
2. Query the Cloud Monitoring Prometheus API for request count, 5xx rate,
   p50/p95/p99 latency, and instance count. Use
   `run.googleapis.com/request_count`,
   `run.googleapis.com/request_latencies_bucket`, and
   `run.googleapis.com/container/instance_count`; group revision results by
   `revision_name`.
3. Query Cloud Logging for `route_calculated`, `route_rejected`,
   `route_failed`, and `client_error` events in the window. Project fields
   rather than returning raw log envelopes. For route calculations, return
   `timestamp`, `lane`, `status`, and `duration_ms`.
4. Send these two sequential `POST <target-url>/api/route` probes, recording
   client-observed latency, HTTP status, and route status. Mark them as
   agent-generated traffic in the report.

   ```json
   {"origin":"Denver","destination":"Salt Lake City","vehicle_type":"van","service_level":"standard"}
   ```

   ```json
   {"origin":"Miami","destination":"Minneapolis","vehicle_type":"van","service_level":"standard"}
   ```

## Interpretation and report

Cloud Run latency is edge-to-edge and is not the release gate's in-process
`POST /api/route` p95. `route_calculated.duration_ms` excludes configured
upstream delay. High Cloud Run or synthetic latency with low route duration can
therefore indicate time outside the route engine.

Report `Assessment`, `User impact`, `Evidence`, `Recommendation`, and `Limits`.
Separate observations from inferences. Do not claim a cause unless two
independent signals support it. Identify unavailable evidence, permission
failures, and delayed log ingestion rather than treating them as healthy data.
