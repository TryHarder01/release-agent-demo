# Follow-on work: intentional regressions

> **Status: not yet implemented.** The app on `main` is deliberately healthy.
> This document specifies the three regression PRs to add next, so the Oz demo
> has something realistic to catch.

Regressions A and B share one point: **CI stays green, the deploy succeeds,
and only post-deployment verification catches the problem.** If a regression
fails CI, it is useless for this demo — the whole story is that build-time
signals were insufficient.

Regression C is a different point, and it needs the other two to land first:
**the deterministic release gate can also be wrong, not just CI.**
`scripts/verify-release.mjs` checks real numbers against real thresholds — that
part is correct and should stay a script, not an agent. But its load test only
ever samples four fixed lanes (`verify-release.mjs`'s `LANES` array), so a
regression gated on something those four lanes never trigger is invisible to
it by construction. No threshold rule catches "the gate didn't test what
changed" — only something that reads the diff *and* the gate's own sampling
design can. That's the gap an Oz agent fills, and it's a different job from
running `scripts/verify-release.mjs` faster or more often.

The current split makes this work:

| Stage | What runs | Where |
| --- | --- | --- |
| CI (`ci.yml`) | unit + API tests, web build, container build | on every PR |
| Release (`release.yml`) | Playwright critical flow, health, error rate, p95 | against a deployed candidate |

Playwright is **intentionally absent from CI**. That is the gap the release agent fills.

---

## Regression A — functional (schema drift)

**Story.** A backend engineer "tidies up" the API response field naming. Looks
like a harmless rename in review. The frontend still reads the old field.

### The change

In `server/src/routeEngine.js`, rename the response key:

```diff
   return {
     distance_miles: lane.distance,
-    duration_minutes: Math.round(lane.duration * multiplier),
+    duration: Math.round(lane.duration * multiplier),
     status: statusFor(lane.distance),
```

To keep CI green, the server tests must be updated in the same PR — which is
exactly what makes it look reasonable:

- `server/test/routeEngine.test.js` — update the contract assertions
- `server/test/api.test.js` — update `duration_minutes` → `duration`, and the
  test named *"exposes duration as duration_minutes, which is what the UI reads"*

Do **not** touch `web/src/api.js`. That omission is the bug.

### What happens

| Signal | Result |
| --- | --- |
| Unit + API tests | PASS (they were updated) |
| Container build | PASS |
| Deploy | PASS |
| `/health` | PASS |
| Error rate | PASS — the API returns 200, it is just the wrong shape |
| p95 latency | PASS |
| **Playwright `@critical`** | **FAIL** |

`web/src/api.js` validates the response contract and throws
`Malformed route response: missing duration_minutes`. The UI renders
`[data-testid="route-error"]` instead of `route-results`, so the critical spec
fails on its first assertion.

**Expected verdict: `STOP`** (exit code 1) — a critical functionality check failed.

### Branch

```bash
git switch -c regression/rename-duration-field
```

---

## Regression B — performance

**Story.** Someone adds a "traffic-aware enrichment" step that calls a slow
upstream service. Functionally correct, just slow. Nothing in the test suite
measures latency.

### The change

The plumbing already exists on `main`: `server/src/app.js` honours
`ROUTE_DELAY_MS`. There are two ways to stage this, and they demo differently.

**Option 1 — config-only (no code change).** Deploy with the env var set:

```bash
ROUTE_DELAY_MS=2500 IMAGE_REF=<registry image>:git-<full-sha> ./scripts/deploy.sh
# or from CI:
gh workflow run release.yml -f route_delay_ms=2500
```

Fastest to demo, and makes the point that a config change can break a release
just as easily as code. There is no PR to inspect, though.

**Option 2 — a real PR (preferred for the full demo).** Add a plausible-looking
enrichment step in `server/src/app.js` so there is a diff worth reviewing:

```js
// Enrich the lane with live traffic conditions before returning an estimate.
async function enrichWithTraffic(result) {
  await sleep(Number(process.env.TRAFFIC_LOOKUP_MS || 2500));
  return { ...result, traffic_adjusted: true };
}
```

Called from the `/api/route` handler. Add a unit test asserting
`traffic_adjusted === true` so the PR looks well-tested — and note that no test
asserts how long it took.

### What happens

| Signal | Result |
| --- | --- |
| Unit + API tests | PASS |
| Deploy | PASS |
| `/health` | PASS |
| Error rate | PASS — 0% |
| **p95 latency** | **FAIL** — ~2500 ms against a 750 ms budget |
| Playwright `@critical` | PASS — the app works, it is just slow |

**Expected verdict: `NEEDS_REVIEW`** (exit code 2) — functionality is healthy but
the release budget was exceeded.

This is the outcome from the original spec:

> Build and unit tests passed, but the deployed candidate exceeded the 750 ms p95
> latency threshold. Critical UI functionality remains healthy.
> Recommendation: do not promote this revision.

### Branch

```bash
git switch -c regression/traffic-aware-enrichment
```

---

## Regression C — a slow path the gate's own lane list can't see

**Story.** Dispatch asks for relay planning on long-haul lanes: pick a handoff
point so a second driver can take over partway through. A reasonable feature,
reasonably reviewed, reasonably tested. The regression isn't in what it does —
it's in the fact that nothing checks how long it takes on the lanes that
matter, and the release gate structurally cannot sample those lanes.

### Why the gate can't see it

`scripts/verify-release.mjs` drives its load test from a hardcoded four-lane
list:

```js
const LANES = [
  { origin: 'Denver', destination: 'Salt Lake City', vehicle_type: 'van' },   // 312 mi
  { origin: 'Dallas', destination: 'Houston', vehicle_type: 'semi' },         // 239 mi
  { origin: 'Chicago', destination: 'Detroit', vehicle_type: 'box_truck' },   // 283 mi
  { origin: 'Seattle', destination: 'Portland', vehicle_type: 'van' },        // 174 mi
];
```

All four are under 600 miles. `routeEngine.js`'s `statusFor()` only returns
`suboptimal` above 600 miles and `requires_relay` above 900 — so every request
the gate ever issues comes back `optimized`. A code path gated on
`status === 'requires_relay'` is never exercised during release verification,
no matter how many times the gate runs.

### The change

In `server/src/routeEngine.js`, add relay-handoff scoring for long-haul lanes,
called only when `status === 'requires_relay'`:

```diff
+// Long-haul lanes need a mid-route handoff point. Score every facility in the
+// relay network against this lane and return the best match.
+function planRelayHandoff(distance) {
+  let best = null;
+  for (const facility of RELAY_FACILITY_NETWORK) {
+    const score = Math.abs(facility.approxMile - distance / 2);
+    if (!best || score < best.score) best = { ...facility, score };
+  }
+  return best;
+}
+
 export function calculateRoute(input) {
   ...
   const status = statusFor(lane.distance);
+  const relayHandoff = status === 'requires_relay' ? planRelayHandoff(lane.distance) : null;
   ...
   return {
     ...
+    relay_handoff: relayHandoff,
   };
 }
```

`RELAY_FACILITY_NETWORK` is a synthetic in-memory list large enough that the
linear scan costs real time per request — an ordinary "loop over a dataset
instead of indexing it" mistake, not a deliberate `sleep()`. The exact latency
should be benchmarked when this is actually built, not asserted here; the
point stands regardless of the precise number, because the gate never runs
this line at all.

Add a unit test asserting `relay_handoff` is present and well-formed for a
long-haul input — it passes, and proves correctness, not speed:

- `server/test/routeEngine.test.js` — a `distance > 900` case gets a
  `relay_handoff` object back

### What happens

| Signal | Result |
| --- | --- |
| Unit + API tests | PASS |
| Container build | PASS |
| Deploy | PASS |
| `/health` | PASS |
| Error rate | PASS |
| p95 latency | **PASS — the four sampled lanes never touch the slow path** |
| Playwright `@critical` | PASS |
| **`scripts/verify-release.mjs` verdict** | **`PROMOTE`** |

This is a false negative, not a missed threshold. The release gate has nothing
to fail — its own test design guarantees it never asks a `requires_relay`
question.

### What actually shows the regression

Nothing in the automated pipeline. Proof has to come from outside the gate's
sampling:

```bash
# Any of the gate's four lanes: fast, as always
curl -s localhost:8080/api/route -d '{"origin":"Denver","destination":"Salt Lake City"}'

# A long-haul lane the gate never tries: slow, and nothing flagged it
# (verified: hashes to 1054 mi -> status "requires_relay")
curl -s localhost:8080/api/route -d '{"origin":"Miami","destination":"Minneapolis"}'
```

In production, this is what `grafana/fleetnet-observability-firehose.json`'s
per-revision percentile panels are for: real traffic includes long-haul lanes
even though the release gate's synthetic traffic doesn't. But per
`grafana/README.md`, that dashboard is deliberately **not a second gate** — it's
context a human or an agent reads, not a rule that blocks promotion. Nothing
today connects "the diff touches `requires_relay`" to "the gate's `LANES`
array has no lane over 900 miles." That connection is exactly the kind of
synthesis a boolean rule can't express and an Oz agent can: read the diff, read
the gate's own test design, and flag the coverage gap *before* trusting a
`PROMOTE`.

**Expected verdict from `scripts/verify-release.mjs`: `PROMOTE`.** That verdict
is the demo — showing it's wrong is the point, not a bug to fix in the gate.

### Branch

```bash
git switch -c regression/relay-handoff-planning
```

---

## Verified behaviour

Regressions A and B have been confirmed against a real container on `main`.
Regression C has not been built yet, so its behavior above is a prediction
from reading the gate's source, not a run — confirm it the same way once the
branch exists.

```
$ ROUTE_DELAY_MS=2500 ./scripts/verify-local.sh

  PASS  status=ok version=perftest
  PASS  error rate 0.00% (threshold < 1.00%)
  FAIL  p95 route latency 2508.49ms (threshold < 750ms)
  PASS  critical specs (0 failed)

  NEEDS_REVIEW — Functionality is healthy but the release budget was exceeded: p95_latency.
```

The healthy path returns `PROMOTE` with p95 ≈ 0.7 ms.

---

## Rehearsing locally

No GCP required:

```bash
./scripts/verify-local.sh                    # healthy   -> PROMOTE (exit 0)
ROUTE_DELAY_MS=2500 ./scripts/verify-local.sh # slow      -> NEEDS_REVIEW (exit 2)
```

For regression A, check out the branch and run the same command — it will
return `STOP` (exit 1).

For regression C, `verify-local.sh` will return `PROMOTE` — that's expected,
not a test failure. The gap only shows by comparing what the gate sampled
(`curl` the four `LANES` lanes) against what it didn't (`curl` a long-haul
lane) on the same running container.

## Suggested demo order

1. Show `main` deploying clean → **PROMOTE**.
2. Open regression B → CI green, deploy green, **NEEDS_REVIEW** on latency.
   Makes the case that CI alone is not a release gate.
3. Open regression A → CI green, deploy green, **STOP** on the critical flow.
   Makes the case that health checks alone are not a release gate either.
4. Open regression C → CI green, deploy green, gate says **PROMOTE**. Have the
   Oz agent read the diff and the gate's `LANES` array and flag the coverage
   gap anyway. Makes the case that the release gate itself isn't the ceiling —
   synthesizing evidence the gate was never designed to check is a distinct
   job, and it's the one an agent is for.
