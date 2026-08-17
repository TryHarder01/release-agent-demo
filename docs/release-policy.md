# Release policy

Evaluated by `scripts/verify-release.mjs` against a **deployed candidate**, never
against a build artifact.

| Check | Threshold | Source |
| --- | --- | --- |
| Playwright critical flow | all `@critical` specs pass | browser, against the candidate URL |
| Error rate | < 1% | `GET /metrics` → `error_rate` |
| p95 route latency | < 750 ms | `GET /metrics` → `route_latency_ms.p95` |
| Health check | `GET /health` → `status: "ok"` | candidate URL |

Override per-run:

```bash
POLICY_MAX_P95_MS=500 POLICY_MAX_ERROR_RATE=0.005 npm run verify
```

## Verdicts

The verdict is a function of *which* checks failed, not how many:

| Verdict | Exit | Condition |
| --- | --- | --- |
| `PROMOTE` | 0 | Everything passed |
| `NEEDS_REVIEW` | 2 | Health and critical flow pass, but error rate or latency is out of budget |
| `STOP` | 1 | Health or the critical flow failed |

The distinction matters: a slow-but-working candidate is a judgement call a
human might override; a broken user flow is not.

## What the run does

1. `GET /health`
2. `POST /metrics/reset` — zero the counters so p95 reflects this run only
3. 40 requests at concurrency 4 across four lanes
4. `GET /metrics` — read error rate and p95
5. `npx playwright test --grep @critical` against `BASE_URL`
6. Write `release-report.json`, print the verdict, exit with the matching code

## release-report.json

Written on every run for a downstream agent to consume:

```json
{
  "verdict": "NEEDS_REVIEW",
  "reason": "Functionality is healthy but the release budget was exceeded: p95_latency.",
  "base_url": "https://candidate---vantage-route-planner-xxxx.run.app",
  "version": "1caaa46",
  "evaluated_at": "2026-08-17T19:12:04.881Z",
  "policy": {
    "max_error_rate": 0.01,
    "max_p95_route_latency_ms": 750,
    "require_critical_e2e": true,
    "require_health": true
  },
  "checks": {
    "health": true,
    "critical_e2e": true,
    "error_rate": true,
    "p95_latency": false
  },
  "details": { "health": {}, "load": {}, "metrics": {}, "e2e": {} }
}
```

`checks` is the part to branch on — each key maps directly to a policy row.

## Telemetry

In-process counters, no external stack. `GET /metrics`:

```json
{
  "version": "1caaa46",
  "uptime_seconds": 42,
  "requests_total": 40,
  "errors_total": 0,
  "error_rate": 0,
  "route_latency_ms": { "count": 40, "avg": 0.42, "p50": 0.38, "p95": 0.69, "p99": 1.2, "max": 1.4 },
  "routes": { "POST /api/route": { "count": 40, "errors": 0, "error_rate": 0, "latency_ms": {} } }
}
```

Notes:

- `route_latency_ms` is hoisted to the top level because it is the number the
  policy keys off.
- Only **5xx** counts toward `error_rate`. A 400 from a malformed request is the
  API working correctly and must not burn the error budget.
- Latency is a rolling window of the last 500 samples per route.
- The server also emits structured JSON logs to stdout, which Cloud Logging
  parses into queryable fields automatically.
