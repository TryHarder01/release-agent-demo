# FleetNet Demo App — Loose Spec

Build a **small React app that looks like a fleet-routing dashboard**. The app itself should stay simple; its purpose is to give the Oz demo something realistic to deploy, verify, and intentionally break.

## Core app

Single-page React app with:

- Header: **FleetNet**
- Simple form:
  - Origin
  - Destination
  - Vehicle type
- **Calculate Route** button
- Results card showing:
  - Estimated distance
  - Estimated duration
  - Route status
- Small **System Status** indicator

Use fake/static data. No real routing integration is needed.

## Backend

Add a tiny API service with something like:

`POST /api/route`

Return predictable JSON:

```json
{
  "distance_miles": 312,
  "duration_minutes": 338,
  "status": "optimized"
}

```

Also expose:

`GET /health`

Optional:

`GET /metrics`

Keep the backend intentionally lightweight.

## Deployment

- Code lives in GitHub.
- Containerize it.
- Deploy to GCP, preferably Cloud Run.
- Deployment should be easy to trigger from CI or a script.
- Have a stable URL that Playwright/Oz can test.

## Tests

Include:

- Basic unit tests
- API test
- One Playwright end-to-end test:
  1. Load app
  2. Enter origin/destination
  3. Click Calculate Route
  4. Verify route results appear

The happy-path test should be obvious and deterministic.

## Make it intentionally breakable

We want a PR/change that looks reasonable but creates a release problem.

Ideally support two failure modes.

### Functional regression

Example:

Change the API response from:

```json
{"duration_minutes": 338}

```

to:

```json
{"duration": 338}

```

The app deploys successfully, but the user workflow breaks.

Playwright catches it.

### Performance regression

Add an environment flag or code change that causes `/api/route` to sleep for ~2–3 seconds.

Example:

```text
ROUTE_DELAY_MS=2500

```

The application still works, but latency crosses the release threshold.

This gives us something for monitoring/verification to catch.

## Useful telemetry

At minimum capture:

- request count
- error count/rate
- `/api/route` latency

Don't spend much time building observability. Simple metrics or logs that another process can query are enough.

Target release policy could be:

```text
Playwright critical flow: PASS
Error rate: < 1%
p95 route latency: < 750 ms
Health check: PASS

```

## Demo scenario

The intended Oz demo is:

```text
PR ready
   ↓
Inspect change
   ↓
CI/tests pass
   ↓
Deploy candidate
   ↓
Run Playwright
   ↓
Check health + latency/errors
   ↓
Evaluate release policy
   ↓
PROMOTE / STOP / NEEDS REVIEW

```

For the failure demo, CI should ideally still pass so Oz's post-deployment verification adds visible value.

Example outcome:

> **Release not ready**
>
> Build and unit tests passed, but the deployed candidate exceeded the 750 ms p95 latency threshold. Critical UI functionality remains healthy.
>
> Recommendation: do not promote this revision.

## Important constraint

**Don't overbuild this.**

The app is scenery for the Oz workflow. Prioritize:

1. easy deployment,
2. predictable tests,
3. easy-to-trigger regression,
4. observable post-deployment behavior.

A polished fleet-management UI or real routing logic is not necessary.