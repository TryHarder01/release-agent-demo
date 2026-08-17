# NORTHSTAR

## The bottleneck moved

AI raised how much code a team can produce. It did not raise how fast a team can
review, verify, and release it. The constraint moved downstream, and it landed on
the Platform teams who own the release path.

**Oz helps Vantage ship more changes safely by turning release readiness from a
manual checklist into an agentic verification loop.**

That value compounds on every release, not only on the bad ones — which is why
this beats an incident-response or RCA agent as an opening story. RCA pays out
when something breaks. This pays out every time anything ships.

The obvious alternative is another dashboard, and it doesn't work. Dashboards
emit isolated red/yellow/green. Somebody still has to correlate them and answer
the actual question:

> **Is this candidate okay enough to promote, and what evidence should change my
> decision?**

## The loop

```text
Engineer opens PR
   ↓
GitHub Actions
   ├─ tests
   ├─ build image
   └─ push to Artifact Registry
   ↓
Deploy candidate revision to Cloud Run
   ↓
Oz Release Readiness Agent
   ├─ inspect PR / diff
   ├─ inspect CI results
   ├─ run Playwright critical flow
   ├─ inspect health + Prometheus metrics
   └─ compare against release policy
   ↓
READY / NOT READY / HUMAN REVIEW
```

The demo must not feel like *AI checks CI*. It should feel like Oz owns the
release decision process around a candidate change. What's being demonstrated is
the chain: **change → evidence → deployment → verification → decision.**

## Owns the process, not the promotion

Oz drives the loop: it deploys the candidate, generates load against it, runs the
critical flow, reads telemetry, and makes a bounded call. Bounded is doing real
work in that sentence. The candidate sits at **0% traffic** under its own tagged
URL, so every action Oz takes is reversible and invisible to users. Shifting
traffic (`scripts/promote.sh`) stays a human action.

`HUMAN REVIEW` is a first-class outcome, not a failure to decide. An agent that
resolves every ambiguous case into a binary is worse than one that escalates,
because it launders a judgement call into an apparent fact.

Every brief carries an **explicit unknowns list** for the same reason.

### Verdict vocabulary

`scripts/verify-release.mjs` and `release-report.json` already emit three
verdicts. The demo language maps onto them one-to-one — keep the exit codes,
change only what's spoken:

| Report | Exit | Demo language | Meaning |
| --- | --- | --- | --- |
| `PROMOTE` | 0 | **READY** | Every policy check passed |
| `NEEDS_REVIEW` | 2 | **HUMAN REVIEW** | Works, but outside budget — needs context Oz doesn't have |
| `STOP` | 1 | **NOT READY** | Health or a critical user flow failed |

## Why FleetNet exists

FleetNet is scenery: a small React route planner, a tiny Express backend, one
Cloud Run service. Its only real job is to break in ways where **the signals
disagree**, because a brief is only worth reading when the evidence isn't
unanimous.

Two staged regressions ([docs/regressions.md](docs/regressions.md)), neither
implemented on `main`:

| | Break | What the signals say | Verdict |
| --- | --- | --- | --- |
| **B** | ~2.5 s enrichment latency | tests pass · builds · deploys · `/health` ok · error rate 0% · **Playwright passes too** · p95 ≈ 2500 ms against a 750 ms budget | `NEEDS_REVIEW` |
| **A** | `duration_minutes` renamed to `duration` | tests pass *because the PR updated them, which is what makes it look reasonable in review* · builds · deploys · `/health` ok · error rate 0% *because the API returns 200 with the wrong shape* · p95 fine | `STOP` |

**B is the demo beat.** Nothing is broken. Every functional check is green,
including the end-to-end flow, and the change still shouldn't ship as-is:

> **Not ready to promote.** Functional checks passed, but the candidate revision
> exceeds the p95 latency budget: 2508 ms against a 750 ms threshold.

That is the moment worth building the whole demo around — the agent acted,
observed production-like behavior, verified against policy, and made a bounded
decision that no build-time signal could have produced.

**A is the deeper case**, and it's the answer to "so you added a latency check."
Every number is green and the product is broken. Only an assertion against the
real user flow disagrees. Keep it in reserve for the room that pushes.

## What the agent collects

| Evidence | Source | Status |
| --- | --- | --- |
| PR + diff | GitHub API | not yet |
| CI results | `ci.yml` run conclusion | present |
| Candidate revision + URL | `scripts/deploy.sh` → `GITHUB_OUTPUT` | present |
| Critical flow | `playwright test --grep @critical` against the candidate | present |
| Health + gate telemetry | `/health`, `/metrics`, `release-report.json` | present |
| Correlated runtime metrics | Google Managed Prometheus, scraped from Cloud Run | not yet |
| Approved operating knowledge | runbooks, ownership, escalation | not yet |
| Recent incident signals | — | not yet |

## Why Managed Prometheus

Not for the graphs. The gate reads its own in-process counters
(`server/src/metrics.js`) during a controlled 40-request run at concurrency 4 —
a clean isolated measurement, and deliberately blind to anything outside that
window.

GMP adds an independent source with different properties: continuous rather than
windowed, per-instance rather than per-process, retained rather than reset.
Correlating two sources is the point. It also sets up the sharpest visual in the
deck — a Grafana dashboard sitting green while Oz says hold.

## Portability to Vantage's stack

The demo runs on GitHub Actions, Artifact Registry, Cloud Run, and GMP. Vantage
runs GitHub Enterprise, Buildkite, GAR, GCP, and Grafana/Prometheus. The
substitutions are shallow:

| Demo | Vantage | What changes |
| --- | --- | --- |
| GitHub Actions | Buildkite | the CI-status collector |
| GitHub.com API | GitHub Enterprise | endpoint + auth |
| Artifact Registry | GAR | nothing |
| Cloud Run candidate at 0% | their deploy target | the deploy/rollback adapter |
| GMP | their Prometheus/Grafana | the PromQL endpoint |

The collectors are adapters. The release policy, the evidence model, the verdict
mapping, and the brief format are unchanged. That's the argument for maintaining
this centrally rather than per-team — and it's what makes the deployment and
inference controls a security-model conversation rather than a rewrite.

## Enterprise hypothesis — to validate, not assert

Laptop policy, approval chains, proxy-routed LLM access, and uneven developer
tooling make "give every engineer a powerful agent" the less likely enterprise
deployment. The more plausible shape is a **centrally reviewed, versioned
agent/skill** with approved data access, policies, and guardrails.

That is a hypothesis about enterprise constraints in general, not a claim about
Vantage's environment. Use discovery to learn the actual ownership, access, and
compliance boundaries before designing to them.

This repo already leans that way: the standard lives in versioned files
(`CLAUDE.md`, `.claude/skills/`) rather than in individual prompting, and
`AGENTS.md` symlinks to the same text so a second agent runtime loads identical
rules.

## What this changes about the repo

`CLAUDE.md` says the release gate is the product. Keep treating the code that
way — don't weaken the gate, don't move Playwright into CI, don't make route
output non-deterministic. Those constraints are what keep the evidence
trustworthy.

But the gate is an instrument. The brief is what someone reads, and the loop is
what's being sold. The work ahead is evidence collection, verdict vocabulary, and
brief generation — not more thresholds.

---

[README.md](README.md) (what it does) · [CLAUDE.md](CLAUDE.md) (how to work in
it) · [docs/release-policy.md](docs/release-policy.md) (gate + report schema) ·
[docs/regressions.md](docs/regressions.md) (the two staged breaks)
