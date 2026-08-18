# Release-agent demo runbook

How to run the FleetNet demo end to end, and what each step is meant to prove.

> Keep this off `main`. The release agent reviews a checkout of this repo, and
> a document that states the finding in advance turns its conclusion into a
> lookup. It lives on `docs/demo-runbook` as a draft pull request.

## What the demo proves

One revision, one moment, three readings:

| Source | Reading | Says |
| --- | --- | --- |
| `scripts/verify-release.mjs` | p95 1.21 ms | `PROMOTE` |
| Cloud Monitoring | p95 9.5–13.5 ms | green |
| A lane a dispatcher can select | 2.6 s | unfit to ship |

Nothing is lying. The gate measures exactly what it was built to measure, and
the dashboard correctly reports an aggregate. Neither can see a regression
confined to part of the input space, because neither was built to ask which
part changed.

That is the argument: static gates validate the risks someone anticipated when
they wrote the gate. Reasoning about *this* change against *this* gate's design
is a different job.

## Before you start

```bash
gcloud config get-value project   # warpdemo-505821
oz whoami                          # logged in, team Demo
gh auth status                     # TryHarder01
```

The Oz environment (`DemoApp`, `6E6yxZoQ6uUZCFDrQDiZ7Z`), its image, and the
`GCP_SA_KEY` secret are already configured. See [oz/README.md](../oz/README.md)
to rebuild any of it.

Allow about 25 minutes for a full run, most of it waiting on CI and Cloud Run.

## The moving parts

| Piece | Value |
| --- | --- |
| Service | `fleetnet-route-planner`, `northamerica-northeast1` |
| Production URL | `https://fleetnet-route-planner-majbcfnhwq-nn.a.run.app` |
| Candidate URL | `https://candidate---fleetnet-route-planner-majbcfnhwq-nn.a.run.app` |
| Regression branch | `regression/relay-handoff-planning` |
| Agent skill | `.claude/skills/release-readiness/SKILL.md` |

## Run the demo

Six beats. Each one adds a signal that agrees with the last, until the final
one disagrees with all of them.

### 1. Show production healthy

```bash
gh workflow run release.yml --ref main
```

Expect `PROMOTE`. This is the control: the same pipeline, the same policy, a
clean commit. Promote it so production is a known baseline:

```bash
./scripts/promote.sh <candidate_revision>
```

### 2. Show the change under review

Open the regression pull request. Point at three things:

- CI is green. Unit tests, the container build, the web bundle, all passing.
- The change is small, tested, and reads as reasonable.
- The body says, honestly, that nobody profiled it under load.

That last line matters. The author disclosed the risk and it shipped anyway,
because the gate said yes.

### 3. Say go

Add the `deploy-candidate` label to the pull request in the GitHub UI. Nothing
else runs on your machine.

GitHub Actions records the revision serving production, deploys the pull
request's head commit as a **0%-traffic** candidate under its own tagged URL,
runs the release gate, and launches the agent. Production keeps serving `main`,
so the two revisions differ by exactly this change and sit on identical
infrastructure.

Expect **`PROMOTE`**. Health, 0% errors, p95 1.21 ms against a 750 ms budget,
all four critical specs green. A comment appears on the pull request with the
verdict, both revision names, and a link to the agent's brief.

Deploying by hand still works, and is worth knowing if a label misfires:

```bash
gh workflow run release.yml --ref regression/relay-handoff-planning
```

### 4. Read the dashboard before the agent finishes

```bash
cd grafana && docker compose up -d   # localhost:3000
```

Do this **now**, while the agent is still working. The candidate's p95 reads
9.5–13.5 ms, indistinguishable from the baseline revision beside it.

That timing is the point, not a convenience. Every instrument the team owns
says ship it: CI green, gate `PROMOTE`, dashboard flat. The dashboard is not
broken and not lying — the traffic that would move it has never been sent.

### 5. Show what nothing asked

```bash
CAND=https://candidate---fleetnet-route-planner-majbcfnhwq-nn.a.run.app
curl -s -o /dev/null -w '%{time_total}s\n' $CAND/api/route \
  -H 'Content-Type: application/json' \
  -d '{"origin":"Denver","destination":"Salt Lake City"}'   # 0.09s
curl -s -o /dev/null -w '%{time_total}s\n' $CAND/api/route \
  -H 'Content-Type: application/json' \
  -d '{"origin":"Denver","destination":"Phoenix"}'          # 2.6s
```

Better in a browser, because it needs no explanation: open the candidate URL,
plan Denver to Salt Lake City, then change one dropdown to Phoenix. Measured
44 ms and 2086 ms.

### 6. Read the brief, then look at the dashboard again

The comment on the pull request links it. Expect **HUMAN REVIEW**, explicitly
disagreeing with the gate.

Then refresh Grafana. The candidate's p95 now reads about 9960 ms while the
baseline holds at 9.5 ms.

Nothing about the code changed between those two readings. The agent generated
the traffic that made the problem visible — it did not find a signal someone
had missed, it produced one that did not exist. That is the difference between
reading dashboards and reasoning about a change.

## What the agent should find

Check the brief against this. Treat a miss as a real result, not something to
paper over.

- `planRelayHandoff()` runs only above 900 miles.
- Every gate lane is 174–372 miles, and all four critical specs use one
  312-mile lane. The gate cannot reach the added code.
- `release-report.json`'s own `dispatch_profiles` shows `status=optimized` for
  all 40 requests — the gate's report proves it never ran the change.
- 20 of the 90 lane pairs selectable in the UI exceed 900 miles.
- Re-running the gate's load with long-haul lanes included puts p95 at
  ~2500 ms against the 750 ms threshold.
- **The severe one:** the scan is synchronous, so on one CPU a single long
  request stalls every concurrent request. The critical lane goes from 0.128 s
  to 2.623 s. p50 stays at 0.5 ms, so no aggregate shows it.

The last point is the one to lead with. A sampling gap is a testing problem. An
agent reasoning about how a change interacts with the runtime is the thing no
one wrote a check for.

## Reset

```bash
./scripts/promote.sh <clean main revision>   # if traffic moved
```

Leave the regression pull request open and unmerged. `main` stays healthy —
`CLAUDE.md` and `docs/regressions.md` both depend on that.

## Common failures

| Symptom | Cause |
| --- | --- |
| `release.yml` fails at deploy | The image for that sha is not in Artifact Registry yet. Wait for the branch's CI push job. |
| Long-haul lanes respond fast | Cold instance, or you hit production rather than the candidate. Check `/health` reports the candidate's commit. |
| Agent run fails during setup | Environment setup, not the agent. Check the image is `r0124x/oz-release-agent:latest`. |
| Agent reports no telemetry | Log ingestion lags 10–15 s, and a revision only has logs once something calls it. |
| `duration_ms` missing from logs | The deployed image predates that field. Check the revision's commit. |

## What this doesn't show yet

This is a demo, not a production release process. Every number in it is real
and measured, and the value is in what it invites someone to picture next. Name
these before the room does, then hand each one back as a question.

- The release path launches the agent, but its brief is advisory and no one
  is required to read it. Closing the loop — the agent gating promotion, or
  filing the follow-up itself — is a configuration change, not new capability.
- One service, synthetic traffic. The harder case is a change that looks local
  and lands on a service another team owns. That is where the monorepo
  argument lives, and this demo only gestures at it.
- The agent reads a diff, a gate, logs, and metrics. It has no runbooks, no
  ownership map, no incident history. Those are the inputs a platform team
  already has and could hand it.
- Verified on one day, on this infrastructure.
