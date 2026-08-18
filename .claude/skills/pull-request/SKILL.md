---
name: pull-request
description: The standard for opening, writing, and reviewing a pull request in this repo — evidence over assertion, an explicit unverified list, a stated expected release verdict, and visual proof for anything that renders. Load before opening a PR, writing a PR description, pushing a branch for review, or reviewing someone else's PR. Also load when deciding how to split work into PRs.
---

# Pull requests

The diff already says what changed. **The PR body argues that the change is
safe to merge, and shows the evidence.**

The reviewer's scarcest resource is trust. Code plus a confident summary spends
trust. The same code plus reproducible evidence and a frank list of what you
couldn't verify earns it — and gets the next PR merged faster.

The bar: **a reviewer who reads only the body can predict what's in the diff,
and can re-run every claim in it.**

## The rules

### 1. Never assert what you can run

"Tests pass" is a claim. A pasted terminal block is evidence. Paste the real
output — actual numbers, the actual verdict line. If you didn't run it, it goes
in Notes (rule 2), not in the body as prose.

```
$ ./scripts/verify-local.sh
   PASS  error rate 0.00% (threshold < 1.00%)
   PASS  p95 route latency 1.05ms (threshold < 750ms)
   PROMOTE — All release policy checks passed.
```

Every number needs the command that regenerates it. Fabricating or cleaning up
output is the one unrecoverable failure here — worse than shipping a bug,
because it poisons every PR you open afterward.

### 2. Declare what you couldn't verify, and why

A short **Notes** section naming the gaps. This is the highest-value habit in
the standard: it tells the reviewer where to spend attention, and separates a
report from a sales pitch.

> `gcloud` isn't installed on this machine, so the Cloud Run scripts and
> workflow are written but unexecuted. `verify-local.sh` covers the identical
> sequence minus GCP, and that path is fully exercised.

Name the substitute and how close it is. "Untested, because X" beats silence.
Silence reads as a claim.

### 3. Verify against the real artifact

Unit tests prove functions. This repo's thesis is that passing functions are
not a release signal. If the PR touches runtime behavior, run what ships:

```bash
./scripts/verify-local.sh        # builds the image, runs it, gates it
```

A green `npm test`, alone, is a weak claim in this repo.

### 4. Predict the release verdict

State it **before** the gate run, then show the run. A prediction is
falsifiable; a summary written afterward isn't.

> **Expected verdict: `NEEDS_REVIEW`** (exit 2) — features healthy, p95 over
> budget. Confirmed below.

If the prediction was wrong, say so and say what you'd misunderstood. A
corrected prediction signals more understanding than a lucky one.

### 5. Show anything that renders

Embed a screenshot for UI changes, a walkthrough video for a flow. `npm run
capture` produces both. Link with raw GitHub URLs on the PR branch:

```markdown
![FleetNet](https://github.com/<org>/<repo>/raw/<branch>/docs/media/route-results.png)
```

Curated media belongs in `docs/media/` (tracked). Runtime output in `/media/`
is gitignored — copy it, don't move the gitignore.

### 6. Make the review path short

A 40-file PR has maybe three files that carry the argument. Name them. Use a
table for anything with a shape — endpoints, thresholds, verdicts, expected
signals — because a reviewer scans a table and reads a paragraph.

Order the body by what the reviewer needs: **what this is → the interesting
design decision → evidence → gaps → what's deliberately out of scope.** Not by
directory, and not by the order you built it.

### 7. Say what you deliberately didn't do

Scope discipline is visible in the body or it isn't visible at all. Name what
you left out and where it's specified.

> Per discussion, `main` stays healthy. `docs/regressions.md` specifies both
> follow-on PRs in full.

A PR that quietly expands past its stated scope costs more review time than two
PRs would. One argument per PR.

### 8. Leave a handle for whoever comes next

The next reader may be an agent. Prefer artifacts machines consume and humans
read: `release-report.json` with a `checks` object mapping one-to-one onto
policy rows, specs in `docs/` rather than in the PR thread, explicit exit
codes. Design output the next step can branch on without parsing prose.

### 9. Make the undo obvious

State the rollback. Usually `./scripts/promote.sh <previous-revision>`, or
"candidate stays at 0% traffic; nothing to undo." A stated blast radius is a
change a reviewer approves quickly.

## Repo-specific requirements

Not style preferences. Correct a violation before review, not after merge.

| Requirement | Why |
| --- | --- |
| State the expected verdict (`PROMOTE` / `NEEDS_REVIEW` / `STOP`) | It's the repo's unit of meaning |
| Don't move Playwright into `ci.yml` | The CI/release gap is the demo's thesis |
| Regression PRs keep CI green | A regression that fails CI proves nothing about post-deployment verification |
| Don't weaken `web/src/api.js` contract validation | It converts schema drift into a visible e2e failure |
| No randomness or wall-clock dependence in route output | Exact e2e assertions and `retries: 0` depend on determinism |
| Changed the policy or report shape? Show the new `release-report.json` | Downstream agents branch on `checks` |

## Template

**Scale the body to the change.** Most PRs are a paragraph, the evidence, and
the gaps — under 250 words. The headings below are slots to open only when the
change earns them. A heading with three sentences under it should have stayed a
paragraph, and a section that exists because the template listed it reads as
padding. Nothing here requires a 40-file PR's structure for a 4-file PR.

A small change:

```markdown
What this is and why, in two or three sentences. Link the spec.

Then the interesting decision, if there is one, in a sentence or two of prose —
not a section.

**Expected verdict: `X`** — reasoning.

```verbatim command output, real numbers```

One line each on what wasn't run and why, what's deliberately out of scope, and
how to revert.
```

A large change earns headings. Use `## Verification` and `## Notes` verbatim —
reviewers navigate to those by name — and make every other heading name what
its section holds, never its role in the document ("Key decisions" and "The
interesting part" are labels, not information).

```markdown
One or two sentences: what this is and why it exists. Link the spec.

![screenshot](raw-github-url)   <!-- if anything renders -->

## <What it does>
Tables for endpoints / behavior / contracts.

## <The decision, named>
The one design choice a reviewer would otherwise reverse-engineer from the
diff. Say what you rejected and why.

**Expected verdict: `X`** — reasoning.

## Verification
Verbatim command output. Real numbers.

## Notes
- What wasn't run, and why.
- What was substituted, and how close the substitute is.
- Deliberate omissions, with a pointer to where they're specified.
```

Close with the Claude Code attribution line, per the repo's commit convention.

## Before you open it

If the body can't survive *"how do you know?"* on any line, it isn't ready.
Check that every claim has a reproducing command, that the pasted output is
real, that the expected verdict is stated and then confirmed or corrected, and
that the gaps, the out-of-scope work, and the revert path are all named.

`references/worked-example.md` walks through PR #1 rule by rule. Read it before
writing a large PR.
