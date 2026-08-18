---
name: business-logic-explainer
description: Answer plain-language questions about FleetNet's dispatch and pricing business rules — vehicle/service-level policy, SLA commitments, route status and dispatch risk, release-gate judgement calls — by reading the actual code and citing it, for product/revenue people who don't read code. Use when someone asks "how does the app handle X", "what happens if Y", "are we guaranteeing Z", or "what's the rule for W", without them naming files or functions.
---

# Business logic explainer

You are answering someone who does not read code — a PM, revenue, or support
person — but who needs a **precise, code-grounded** answer, not a guess and
not an engineering lecture. Never answer from general logistics/SaaS
intuition. Always resolve the question against this repository's actual
source before answering.

## Where the actual business rules live

Fleet dispatch logic — the primary domain — lives almost entirely in
`server/src/routeEngine.js`. Read `calculateRoute()` end to end for any
dispatch/pricing/SLA question; it is short enough to read in full every time.

- **`VEHICLE_DURATION_MULTIPLIER`** — van/box_truck/semi each apply a fixed
  multiplier to raw travel time (heavier = slower). This is the only place
  vehicle choice affects the numbers.
- **`SERVICE_LEVEL_POLICY`** — standard/expedited/refrigerated each carry a
  `dispatchBufferMinutes`, added on top of drive time to produce
  `delivery_sla_minutes`. This buffer is the SLA commitment quoted to a
  customer — it is not a live capacity or staffing calculation, it's a fixed
  constant per service level.
- **`statusFor(distance)`** — a route's `status` (`optimized` / `suboptimal`
  / `requires_relay`) is a pure function of distance against two fixed
  thresholds (600 mi, 900 mi). Nothing else — not vehicle, not service
  level, not traffic — affects status.
- **`dispatchRiskFor(status, serviceLevel)`** — `dispatch_risk`
  (`on_track` / `monitor` / `attention`) escalates on `requires_relay`
  status or on `expedited` service level. This is the one place two
  inputs combine into a decision; call this out explicitly when asked
  about risk or exceptions handling.
- **Known lanes vs. hashed lanes** — a handful of real city pairs
  (`KNOWN_LANES`) return exact seeded numbers; every other origin/destination
  pair gets a deterministic pseudo-value from an FNV-1a hash of the lane
  string, in the 45–1194 mile / 52–60 mph range. Same input always produces
  the same output — there is no live traffic, weather, or randomness
  anywhere in this app.

Release-gate judgement calls (whether a *build* is fit to ship, not a
dispatch decision) are a secondary, separate rule set:
`scripts/verify-release.mjs` and `docs/release-policy.md` — thresholds for
error rate and p95 latency, and the `PROMOTE` / `NEEDS_REVIEW` / `STOP`
verdict logic. Use this only when the question is about releases/deploys,
not about how a route or shipment is handled.

Supporting files, read only when the question needs them:
- `server/src/app.js` — request handling, `ROUTE_DELAY_MS` injected latency,
  how errors surface as HTTP status codes.
- `server/src/metrics.js` — what counts toward `error_rate` (only 5xx — a 400
  from bad input is not an "error" by this app's definition), and the
  `distance_band` / `traffic_band` classification used for observability
  (same 600/900 mile thresholds as `statusFor`, restated here for metrics
  labels — not an independent rule).
- `web/src/api.js` — what the frontend requires in a response
  (`distance_miles`, `duration_minutes`, `status`) and what it does when a
  field is missing (throws, shows `[data-testid="route-error"]` — it does
  NOT silently guess).
- `e2e/*.spec.js` tagged `@critical` — the user flows that block a release
  if broken.

## Know the limits of what's modeled — don't paper over them

This app's business logic is intentionally shallow: each rule above is an
independent lookup, and **none of them constrain or validate against each
other**. Concretely, as of this writing:

- Any `vehicle_type` can be paired with any `service_level` — e.g.
  `refrigerated` on a `van` is accepted with no eligibility check.
- There is no cost, price, or rate calculation anywhere in the app.
- There is no capacity, weight, or cargo-volume limit for any vehicle.
- `delivery_sla_minutes` is quoted but nothing checks or flags an SLA
  breach after the fact — it's a number returned once, not tracked.
- Nothing varies by time of day, day of week, or season.

If a question assumes one of these exists ("what happens when a refrigerated
order is late," "what's the rate for a semi," "does the system stop you from
overloading a van"), say plainly that the app does not model that today —
don't infer a plausible-sounding answer from the surrounding pattern. Naming
the gap is a correct, useful answer.

## How to work

1. Restate the question in one sentence to confirm scope, then go read code.
   Don't ask the user clarifying questions about internals they won't know —
   go look instead.
2. Read `calculateRoute()` in full for any dispatch/SLA/pricing question,
   even if you think you already know the answer — the function is short and
   the constants change.
3. Trace the actual logic path — read the function, don't infer from naming.
   If behavior depends on a threshold or env var (e.g. `POLICY_MAX_ERROR_RATE`,
   `POLICY_MAX_P95_MS`, `ROUTE_DELAY_MS`, or the 600/900 mile bands), state
   its current value.
4. If the question spans a scenario the code doesn't explicitly handle, say
   so plainly per the section above, rather than filling the gap with a
   plausible-sounding guess.

## How to answer

- Lead with the plain-language answer in 1-3 sentences. No jargon dump before
  the answer.
- Follow with the "why" grounded in code: name the file and function/constant
  that decides it (e.g. "`server/src/routeEngine.js`, `SERVICE_LEVEL_POLICY`
  — expedited adds a 45-minute dispatch buffer, standard adds 180"). A
  non-engineer doesn't need a line number, but a future engineer checking
  your answer does, so include `file:line` for the key claim.
- If the behavior is a threshold or constant, state the number and where (if
  anywhere) it can be overridden, so a non-engineer can tell whether it's a
  hard rule, a tunable policy, or just a hardcoded value nobody's revisited.
- If the answer is "it depends," give the branches in plain terms (e.g. "if
  the route lane was seeded with test data, X; otherwise Y").
- Do not propose code changes unless asked. This skill is for understanding
  current behavior, not for making it different.
- Keep total output short — a Slack-message length answer, not a report.

## Example questions this skill should handle well

- "Does an expedited order get a faster SLA quote than standard, and by how
  much?"
- "If someone books a refrigerated shipment on a regular van, does the system
  stop them?"
- "What makes a route show up as needing a relay driver?"
- "Is route pricing/timing random, or will the same request always get the
  same answer?"
- "If our routing API is slow but not broken, does a release still go out?"
- "What counts as an error for our uptime numbers — do 'bad request' errors
  count against us?"
