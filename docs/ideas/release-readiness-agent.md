Here’s the clean mapping I’d use.


| Pain point                                  | How the release agent helps                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Release verification is fragmented**      | Oz gathers evidence from GitHub, CI, deployment status, Playwright, Prometheus/Grafana, and presents one release decision instead of making an engineer hop across tools.       |
| **Human review becomes the bottleneck**     | The agent handles the repetitive evidence-gathering and first-pass judgment, so Platform/SRE only steps in for ambiguous or high-risk releases.                                 |
| **“CI passed” doesn’t mean “safe to ship”** | Oz verifies the actual deployed candidate, not just the build: critical user flow, latency, errors, health checks, rollout behavior.                                            |
| **Release criteria live in people’s heads** | You encode those rules into a reusable Skill/policy: “p95 &lt; 750 ms, Playwright passes, no critical health failures, schema changes require review,” etc.                     |
| **Risk assessment is inconsistent**         | The agent can inspect the diff and classify the release: routine UI change vs. hot-path backend change vs. infra/schema change, then choose the appropriate verification depth. |
| **Post-deploy checks get skipped**          | Verification becomes part of the workflow. The release isn’t “done” when deployment succeeds; Oz automatically observes the candidate and evaluates it.                         |
| **Evidence gathering is slow**              | Instead of a human spending 10–20 minutes checking dashboards and logs, the agent collects the evidence in parallel and summarizes what matters.                                |
| **Safe automation is hard to expand**       | Start with Oz making a recommendation and requiring human approval. Over time, low-risk releases can auto-promote while uncertain ones still escalate.                          |


The demo should make **three of these painfully obvious**, rather than trying to demonstrate all eight.

I’d center it around:

### 1. CI passed ≠ safe to ship

Your candidate passes GHA.

Oz deploys it.

Playwright passes.

But p95 latency jumps above the release threshold.

**Oz stops promotion.**

That immediately proves why this isn't just CI.

### 2. Fragmented evidence → one decision

Instead of:

```text
GitHub → looks fine
GHA → green
Cloud Run → deployed
Grafana → ?
Playwright → ?
```

the engineer gets:

```text
RELEASE: NOT READY

CI                    PASS
Critical user flow    PASS
Error rate            PASS
p95 latency            FAIL: 1.4s vs 750ms limit

Recommendation:
Do not promote candidate.
```

That's a very tangible improvement.

### 3. Human judgment becomes scalable

The agent isn't replacing the platform engineer's policy.

It's **executing their policy repeatedly**.

That's an important framing:

> “Today, a senior engineer knows which dashboards to check, which tests matter, and what constitutes an acceptable rollout. Oz turns that operational judgment into a repeatable workflow.”

That connects nicely to Warp's broader factory idea: you're taking tacit organizational knowledge and turning it into something executable.

So if you need one sentence for the demo:

> **The release agent takes the manual judgment around ‘is this actually safe to ship?’ and turns it into a repeatable, evidence-backed workflow that scales with release volume.**

That's the core.