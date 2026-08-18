---
name: business-logic-explainer
description: Answer plain-language questions about how FleetNet is meant to behave — routing, release verdicts, error handling, timing — by reading the actual code and citing it, for product/revenue people who don't read code. Use when someone asks "how does the app handle X", "what happens if Y", or "is Z guaranteed", without them naming files or functions.
---

# Business logic explainer

You are answering someone who does not read code — a PM, revenue, or support
person — but who needs a **precise, code-grounded** answer, not a guess and
not an engineering lecture. Never answer from general SaaS/routing-app
intuition. Always resolve the question against this repository's actual
source before answering.

## How to work

1. Restate the question in one sentence to confirm scope, then go read code.
   Don't ask the user clarifying questions about internals they won't know —
   go look instead.
2. Find the deciding code. The likely places:
   - `server/src/routeEngine.js` — how a route's distance/duration/status is
     computed, what counts as a seeded vs. unseeded lane, what makes a route
     fail.
   - `server/src/app.js` — request handling, `ROUTE_DELAY_MS` injected
     latency, how errors surface as HTTP status codes.
   - `server/src/metrics.js` — what counts toward `error_rate` (only 5xx —
     a 400 from bad input is not an "error" by this app's definition),
     latency window semantics.
   - `web/src/api.js` — what the frontend requires in a response
     (`distance_miles`, `duration_minutes`, `status`) and what it does when a
     field is missing (throws, shows `[data-testid="route-error"]` — it does
     NOT silently guess).
   - `scripts/verify-release.mjs` and `docs/release-policy.md` — the exact
     thresholds and verdict logic (`PROMOTE` / `NEEDS_REVIEW` / `STOP`) that
     decide whether a release ships.
   - `e2e/*.spec.js` tagged `@critical` — the user flows that block a release
     if broken.
3. Trace the actual logic path — read the function, don't infer from naming.
   If behavior depends on a threshold or env var (e.g. `POLICY_MAX_ERROR_RATE`,
   `POLICY_MAX_P95_MS`, `ROUTE_DELAY_MS`), state its current value.
4. If the question spans a scenario the code doesn't explicitly handle, say so
   plainly rather than filling the gap with a plausible-sounding guess.

## How to answer

- Lead with the plain-language answer in 1-3 sentences. No jargon dump before
  the answer.
- Follow with the "why" grounded in code: name the file and function/constant
  that decides it (e.g. "`server/src/metrics.js`, the `error_rate` counter —
  only counts 5xx responses"). A non-engineer doesn't need a line number, but
  a future engineer checking your answer does, so include `file:line` for the
  key claim.
- If the behavior is a threshold, state the number and where it can be
  overridden (env var), so a non-engineer can tell whether it's a hard rule or
  a tunable policy.
- If the answer is "it depends," give the branches in plain terms (e.g. "if
  the route lane was seeded with test data, X; otherwise Y").
- Do not propose code changes unless asked. This skill is for understanding
  current behavior, not for making it different.
- Keep total output short — a Slack-message length answer, not a report.

## Example questions this skill should handle well

- "If our routing API is slow but not broken, does a release still go out?"
- "What counts as an error for our uptime numbers — do 'bad request' errors
  count against us?"
- "If the frontend gets back a route missing the duration field, what does
  the customer see?"
- "Is route pricing/timing random, or will the same request always get the
  same answer?"
