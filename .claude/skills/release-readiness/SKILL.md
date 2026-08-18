---
name: release-readiness
description: Decide whether a deployed candidate revision is safe to promote, and challenge whether the release gate's own evidence actually covers what changed. Use when a candidate has been deployed and verified and someone needs a promotion decision — including when the gate already returned PROMOTE. For diagnosing why an already-failing candidate is slow, use `diagnose-release-performance`.
---

# Release readiness

`scripts/verify-release.mjs` is the policy authority. Its thresholds are
correct, its numbers are real, and this skill never overrides them.

This skill answers a different question. The gate validates the risks whoever
wrote it anticipated. It cannot validate a risk nobody encoded a check for,
and it reports a verdict with equal confidence either way. So:

> **Does the evidence behind this verdict actually cover what changed?**

A `PROMOTE` on evidence that never exercised the changed code is not a pass.
It is an untested change with a green label. Treat a `PROMOTE` as the case
needing the most scrutiny, not the least — a failing gate has already done its
job.

Your output is a brief a human uses to decide. You do not decide.

## Bounds

You authenticate with a read-only identity. Never promote, never shift
traffic, never modify a cloud resource, never edit the gate to make a check
pass. Promotion is a human action (`scripts/promote.sh`).

Generating load against a candidate is in bounds: the candidate serves 0% of
traffic under its own tagged URL, so requests you issue reach no user.

## Inputs you should have, or ask for

The candidate revision name, its tagged URL, the pull request or commit range
that produced it, and the gate's verdict (`release-report.json`). If you are
missing one, say so rather than guessing.

## Method

### 1. State what changed, as reachability conditions

Read the diff. For each new or modified code path, write down the input
conditions required to reach it — not what the code does, but what a request
must look like to execute it. A branch nobody can reach in testing is the
thing you are looking for.

Include changes that look local. A modified shared function, a new field, a
changed default, or an altered config affects every caller, including callers
owned by someone else.

### 2. State what the gate actually exercises

Read the gate's own test design, not its results:

- `scripts/verify-release.mjs` — the fixture arrays it drives load from, the
  request count, and the concurrency.
- `e2e/` — the fixtures the `@critical` specs use.
- `server/test/` — what the unit and API tests construct.

Write down the input conditions those fixtures actually produce. Read the
fixture values themselves and work out what they evaluate to. A test's *name*
is not evidence about its coverage; a test can claim to cover a case and
assert something too weak to detect it.

### 3. Intersect the two

Any condition from step 1 that step 2 never produces is a change the gate
reported on without testing. Name it explicitly, with the file and line of
both the changed path and the fixture that fails to reach it.

State this even when — especially when — the verdict is `PROMOTE`.

### 4. Corroborate from telemetry

The gate measures itself over a short controlled window. Cloud Logging and
Cloud Monitoring are independent: continuous, per-instance, retained.

Query the candidate revision's structured logs and enumerate the distinct
classes of input actually observed. Compare that against step 2. If the only
traffic a revision has ever served is the gate's own synthetic load, the
telemetry confirms the blind spot rather than filling it — say that, instead
of reporting the metrics as reassurance.

`diagnose-release-performance` holds the working queries and the read-only
identity. Use it rather than reinventing the commands.

### 5. Close the gap you found

A gap you only describe is a recommendation. A gap you measure is evidence.

Issue targeted requests against the candidate's tagged URL that satisfy the
conditions from step 3, then re-read `/metrics` and Cloud Monitoring. Report
the measured number next to the gate's number and explain why they differ.

Keep the load modest and say exactly what you sent, so anyone can repeat it.

### 6. Judge against the existing policy

Apply the thresholds in `docs/release-policy.md`. Do not invent new ones. If
your measurement crosses a published threshold under conditions the gate never
sampled, that is the finding: the policy was already right, the sampling was
not.

### 7. Preserve visual evidence for reachable UI behavior

When the changed behavior is reachable through the shipped web UI, use computer
use to capture a reviewer-readable contrast: one control path and one affected
path. Attach at least one screenshot of each, plus a short walkthrough video
when the difference is temporal (for example, a wait, stall, or error state).
Link the artifacts from the pull-request brief under **Visual evidence** and
say what each proves.

If computer use, attachment, or the relevant UI path is unavailable, put that
in **Unknowns**. Never silently omit visual evidence for a UI-reachable change.

Post the completed brief as a comment on the pull request under review. The
pull request is the human review surface; an Oz-run-only result is incomplete.

## Verdict

Use the vocabulary in `NORTHSTAR.md`, which maps onto the report's verdicts:

| Verdict | Meaning |
| --- | --- |
| **READY** | Checks passed, and the evidence demonstrably covers what changed |
| **HUMAN REVIEW** | Works, but outside budget, or the evidence does not cover the change |
| **NOT READY** | Health or a critical user flow failed |

`HUMAN REVIEW` is a real outcome, not a failure to decide. Resolving a
judgement call into a binary launders it into an apparent fact. An unverified
change is a `HUMAN REVIEW` even when every check is green — and your brief must
then say plainly that it disagrees with the gate, and why.

## The brief

Follow the evidence standard in `.claude/skills/pull-request/SKILL.md`. Never
assert what you can run.

- **Verdict** and a one-paragraph reason a non-author can act on.
- **What changed**, as reachability conditions (step 1).
- **What the evidence covers**, as a table: each check, the number, and the
  command that regenerates it. Include the gate's verdict as a row.
- **Coverage gaps** — changed paths no check reaches, with file and line.
- **What you measured yourself**, with the exact requests you issued.
- **Visual evidence** for UI-reachable changed behavior, with artifact links;
  otherwise the reason it could not be captured.
- **Unknowns** — what you could not verify and why. Required, never empty. A
  brief with no unknowns is a sales pitch.
- **What would change this decision** — the specific evidence that would move
  the verdict either way.

Post this complete brief to the pull request as a comment. Include the direct
artifact links there, not only in the Oz run.

Report a gap you found and could not measure. Report a gap you suspected and
disproved. Both are more useful than a clean narrative.
