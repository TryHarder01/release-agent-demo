---
name: pull-request
description: The standard for opening, writing, and reviewing a pull request in this repo — evidence over assertion, an explicit unverified list, a stated expected release verdict, and visual proof for anything that renders. Load before opening a PR, writing a PR description, pushing a branch for review, or reviewing someone else's PR. Also load when deciding how to split work into PRs.
---

# What a pull request looks like here

A PR is not a changelog. The diff already says what changed. **The PR body is an
argument that this change is safe to merge, and the evidence backing it.**

The reviewer's scarcest resource is trust. An agent that produces a lot of code
and a confident summary spends trust. An agent that produces the same code with
reproducible evidence and a frank list of what it could not verify *earns* it —
and the second agent gets its next PR merged faster. Optimize for the second.

The bar: **a reviewer who reads only the PR body should be able to predict what
they'll find in the diff, and should be able to re-run every claim in it.**

---

## The rules

### 1. Never assert what you can run

"Tests pass" is a claim. A pasted terminal block is evidence. Paste the real
output — the actual numbers, the actual verdict line — not a paraphrase and
never an invented one. If you didn't run it, it goes in the unverified list
(rule 2), not in the body as prose.

Every number in the body should come with the command that regenerates it.

```
$ ./scripts/verify-local.sh
   PASS  error rate 0.00% (threshold < 1.00%)
   PASS  p95 route latency 1.05ms (threshold < 750ms)
   PROMOTE — All release policy checks passed.
```

Fabricating or "cleaning up" output is the one unrecoverable failure in this
repo. It is worse than shipping a bug, because it poisons every future PR you
open.

### 2. Declare what you could not verify, and why

A short **Notes** section naming the gaps. This is the highest-leverage habit in
the whole standard: it tells the reviewer exactly where to spend their attention,
and it is the difference between a report and a sales pitch.

> `gcloud` isn't installed on this machine, so the Cloud Run scripts and workflow
> are written but unexecuted. `verify-local.sh` covers the identical sequence
> minus GCP, and that path is fully exercised.

Say what you substituted and how close the substitute is. "Untested" with a
reason beats silence; silence reads as a claim.

### 3. Verify against the real artifact, not the nearest proxy

Unit tests prove functions. This repo's whole thesis is that functions passing
is not a release signal. Before opening a PR that touches runtime behavior, run
the thing that actually ships:

```bash
./scripts/verify-local.sh        # builds the image, runs it, gates it
```

A green `npm test` in a PR body, alone, is a weak claim here — and this repo was
built specifically to make that point.

### 4. Predict the release verdict

State it **before** you run the gate, then show the run. A prediction is
falsifiable; a summary written after the fact is not.

> **Expected verdict: `NEEDS_REVIEW`** (exit 2) — functionality healthy, p95 over
> budget. Confirmed below.

If the prediction was wrong, say so and explain what you'd misunderstood. A
corrected prediction is a stronger signal of understanding than a lucky one.

### 5. Show, don't describe, anything that renders

For UI changes, embed a screenshot; for a flow, a walkthrough video. `npm run
capture` produces both. Link them with raw GitHub URLs on the PR branch:

```markdown
![FleetNet](https://github.com/<org>/<repo>/raw/<branch>/docs/media/route-results.png)
```

Curated media belongs in `docs/media/` (tracked). Runtime output in `/media/` is
gitignored — copy, don't move the gitignore.

### 6. Make the review path short

A 40-file PR has maybe three files that carry the argument. Name them. Use
tables for anything with a shape — endpoints, thresholds, verdicts, expected
signals — because a reviewer scans a table and reads a paragraph.

Order the body by what the reviewer needs: **what this is → the interesting
design decision → evidence → gaps → what's deliberately out of scope.** Not by
directory, and not chronologically by how you built it.

### 7. Say what you deliberately did not do

Scope discipline is visible in the body or it isn't visible at all. If you left
something out, name it and say where it's specified.

> Per discussion, `main` stays healthy. `docs/regressions.md` specifies both
> follow-on PRs in full.

A PR that quietly expands beyond its stated scope costs more review time than
two PRs would have. One argument per PR.

### 8. Leave a handle for whoever comes next

The next reader may be an agent. Prefer artifacts that machines can consume and
humans can read: `release-report.json` with a `checks` object mapping one-to-one
onto policy rows, specs written down in `docs/` rather than in the PR thread,
explicit exit codes. Design the output so the next step can branch on it without
parsing prose.

### 9. Make the undo obvious

State how to revert or roll back. Here that's usually `./scripts/promote.sh
<previous-revision>`, or "candidate stays at 0% traffic; nothing to undo." A
change whose blast radius is stated is a change a reviewer can approve quickly.

---

## Repo-specific requirements

These are not style preferences. A PR that violates one should be corrected
before review, not merged and fixed later.

| Requirement | Why |
| --- | --- |
| State the expected release verdict (`PROMOTE` / `NEEDS_REVIEW` / `STOP`) | It's the repo's unit of meaning |
| Do **not** move Playwright into `ci.yml` | The CI/release gap is the demo's entire thesis |
| Regression PRs must keep CI green | A regression that fails CI proves nothing about post-deployment verification |
| Don't weaken `web/src/api.js` contract validation | It's what converts schema drift into a visible e2e failure |
| Don't introduce randomness or wall-clock dependence in route output | Exact e2e assertions and `retries: 0` depend on determinism |
| If you changed the policy or report shape, show the new `release-report.json` | Downstream agents branch on `checks` |

---

## Template

```markdown
One or two sentences: what this is and why it exists. Link the spec.

![screenshot](raw-github-url)   <!-- if anything renders -->

## <What it does>
Tables for endpoints / behavior / contracts.

## <The interesting decision>
The one design choice a reviewer would otherwise have to reverse-engineer from
the diff. Say what you rejected and why.

**Expected verdict: `X`** — reasoning.

## Verification
Verbatim command output. Real numbers.

## Notes
- What wasn't run, and why.
- What was substituted, and how close the substitute is.
- Deliberate omissions, with a pointer to where they're specified.
```

Close with the Claude Code attribution line, per the repo's commit convention.

---

## Worked example: PR #1

[`TryHarder01/release-agent-demo#1`](https://github.com/TryHarder01/release-agent-demo/pull/1)
— *"Vantage Route Planner: app, tests, and post-deployment release gate"*,
7,518 additions across 40 files. It is the reference implementation of this
standard; skim it before writing a large PR.

What it did, mapped to the rules above:

- **Led with the argument, not the inventory.** Opened with what the app is for
  ("something to be deployed, verified, and eventually broken on purpose") and
  linked `docs/spec.md`. Never listed the 40 files.
- **Embedded a screenshot and a Playwright-recorded `.webm`** at the top, via raw
  branch URLs — the reviewer saw the working app before reading a word of prose.
- **Gave the release gate its own section**, with the policy as a table and the
  three verdicts as a table, plus one sentence on the design decision that
  actually needed defending: why `NEEDS_REVIEW` exists as a middle verdict at all
  ("slow but working is a judgement call a human might override; a broken user
  flow isn't").
- **Pasted the full `verify-local.sh` run verbatim** — health, load, telemetry,
  Playwright, `PROMOTE`. Then pasted the *failure* path too:
  `ROUTE_DELAY_MS=2500` producing `NEEDS_REVIEW` on a 2508 ms p95 with the
  critical flow still green. Showing the gate catching something is stronger
  evidence than showing it passing.
- **Named the gap without being asked.** `gcloud` wasn't installed, so the Cloud
  Run scripts were written but unexecuted — stated plainly, with the local
  equivalent that *was* exercised.
- **Declared scope.** Both intentional regressions were specified in
  `docs/regressions.md` and deliberately not built, with a table of each one's
  expected verdict, so `main` stayed healthy. The `ROUTE_DELAY_MS` plumbing one
  of them needs shipped in that PR — groundwork in, behavior out.
- **Left machine-readable handles**: `release-report.json` with `checks`, exit
  codes 0/1/2, and the follow-on work written into `docs/` rather than a comment
  thread.

Where a future PR should go further than #1 did: #1 verified locally because
GCP wasn't reachable. When it is, verify against a real deployed candidate URL
and paste that run. Substitutes are acceptable when named — but the real thing,
when available, is not optional.

---

## Self-check before you open it

- [ ] Every claim in the body has a command that reproduces it
- [ ] Real output pasted, nothing paraphrased or invented
- [ ] Ran `./scripts/verify-local.sh` if runtime behavior changed
- [ ] Expected verdict stated, and confirmed or corrected
- [ ] Screenshot or video for anything that renders
- [ ] The three files that carry the argument are named
- [ ] Unverified gaps listed with reasons
- [ ] Out-of-scope work named and pointed at its spec
- [ ] Revert path stated
- [ ] Playwright still absent from `ci.yml`

If the body can't survive the question *"how do you know?"* on any line, it
isn't ready.
