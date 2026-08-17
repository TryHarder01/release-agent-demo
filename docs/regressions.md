# Follow-on work: intentional regressions

> **Status: not yet implemented.** The app on `main` is deliberately healthy.
> This document specifies the two regression PRs to add next, so the Oz demo has
> something realistic to catch.

The point of each regression is the same: **CI stays green, the deploy succeeds,
and only post-deployment verification catches the problem.** If a regression
fails CI, it is useless for this demo — the whole story is that build-time
signals were insufficient.

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

## Verified behaviour

Both verdicts have been confirmed against a real container on `main`:

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

## Suggested demo order

1. Show `main` deploying clean → **PROMOTE**.
2. Open regression B → CI green, deploy green, **NEEDS_REVIEW** on latency.
   Makes the case that CI alone is not a release gate.
3. Open regression A → CI green, deploy green, **STOP** on the critical flow.
   Makes the case that health checks alone are not a release gate either.
