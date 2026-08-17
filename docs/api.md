# API

Four endpoints, served by the same Express process that serves the React bundle
(`server/src/app.js`). There is no separate API origin.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/route` | Calculate a route |
| `GET /health` | Liveness + running version |
| `GET /metrics` | Request count, error rate, route latency percentiles |
| `POST /metrics/reset` | Zero the counters before a measurement run |

Request bodies are JSON, capped at 64 kb. Unmatched `/api/*` paths return `404`
`{"error":"not found"}`; everything else falls through to the SPA.

## POST /api/route

```bash
curl -s localhost:8080/api/route \
  -H 'Content-Type: application/json' \
  -d '{"origin":"Denver","destination":"Salt Lake City","vehicle_type":"van"}'
```

### Request

| Field | Required | Notes |
| --- | --- | --- |
| `origin` | yes | Free text. Trimmed; case- and whitespace-insensitive for lane lookup |
| `destination` | yes | Same |
| `vehicle_type` | no | `van` (default), `box_truck`, or `semi` |

### Response

```json
{
  "distance_miles": 312,
  "duration_minutes": 338,
  "status": "optimized",
  "vehicle_type": "van",
  "lane": "Denver → Salt Lake City"
}
```

`lane` echoes the caller's original casing, not the normalized lookup key.

The frontend treats `distance_miles`, `duration_minutes`, and `status` as a hard
contract: `web/src/api.js` throws `Malformed route response: missing <fields>` if
any of the three is absent or null, and the UI renders
`[data-testid="route-error"]` instead of results. Renaming or dropping one of
those keys is a **breaking change** even though the request still returns `200` —
that is precisely regression A in [regressions.md](regressions.md).

### Errors

| Status | Body | When |
| --- | --- | --- |
| `400` | `{"error":"origin is required"}` | Missing or blank `origin` |
| `400` | `{"error":"destination is required"}` | Missing or blank `destination` |
| `400` | `{"error":"vehicle_type must be one of: van, box_truck, semi"}` | Unknown vehicle |
| `500` | `{"error":"internal error"}` | Unexpected failure |

Only 5xx counts against the error budget. A `400` is the API working correctly
and must not burn it — see [release-policy.md](release-policy.md).

## Routing behaviour

Routing is fake and **fully deterministic** (`server/src/routeEngine.js`): the
same inputs always produce the same numbers. Nothing in the output depends on
randomness or wall-clock time, which is why the end-to-end assertions can be
exact and Playwright runs with `retries: 0`.

### Seeded lanes

Hand-picked city pairs return plausible real-world numbers. Values below are for
a van; both directions of Denver ↔ Salt Lake City are seeded.

| Lane | Distance | Duration |
| --- | --- | --- |
| Denver → Salt Lake City | 312 mi | 338 min |
| Los Angeles → Phoenix | 372 mi | 355 min |
| Chicago → Detroit | 283 mi | 269 min |
| Dallas → Houston | 239 mi | 224 min |
| Seattle → Portland | 174 mi | 173 min |

Anything else is derived from an FNV-1a hash of the normalized lane: 45–1194
miles at an implied 52–60 mph. Stable across processes and deploys, but not
geographically meaningful — `Miami → Boston` returns 250 mi.

### Vehicle multipliers

Distance is unaffected; duration scales.

| `vehicle_type` | UI label | Multiplier | Denver → Salt Lake City |
| --- | --- | --- | --- |
| `van` | Cargo Van | 1.00× | 338 min → `5h 38m` |
| `box_truck` | Box Truck | 1.08× | 365 min → `6h 05m` |
| `semi` | Semi Trailer | 1.15× | 389 min → `6h 29m` |

The UI renders `duration_minutes` through `formatDuration()`, so the assertion in
`e2e/route.spec.js` is on the formatted string, not the raw minutes.

### Status

Derived from distance alone, so a lane's badge is deterministic too.

| `status` | UI label | Distance |
| --- | --- | --- |
| `optimized` | Optimized | ≤ 600 mi |
| `suboptimal` | Suboptimal | 601–900 mi |
| `requires_relay` | Requires Relay | > 900 mi |

Every seeded lane is `optimized`; the other two badges only appear on hashed
lanes, which is what keeps the UI from always rendering the same badge.

## GET /health

```json
{ "status": "ok", "version": "1caaa46", "uptime_seconds": 42 }
```

`version` is `RELEASE_VERSION`, or `dev` when unset. The release gate requires
`status === "ok"`; the UI polls this every 15 s for the System Status indicator
and shows `build <version>`.

## GET /metrics, POST /metrics/reset

Shape and semantics are documented in
[release-policy.md § Telemetry](release-policy.md#telemetry). `POST /metrics/reset`
returns `{"status":"reset"}` and exists so the verifier can measure only its own
load rather than warm-up noise.
