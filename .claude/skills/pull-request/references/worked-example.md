# Worked example: PR #1

[`TryHarder01/release-agent-demo#1`](https://github.com/TryHarder01/release-agent-demo/pull/1)
— *"Vantage Route Planner: app, tests, and post-deployment release gate."*
7,518 additions across 40 files. Skim it before writing a large PR.

What it did, mapped to the rules:

**Led with the argument, not the inventory.** Opened with what the app is for
("something to be deployed, verified, and eventually broken on purpose") and
linked `docs/spec.md`. Never listed the 40 files.

**Showed the app before describing it.** A screenshot and a Playwright-recorded
`.webm` at the top, via raw branch URLs.

**Gave the release gate its own section.** Policy as a table, three verdicts as
a table, and one sentence defending the decision that needed defending: why
`NEEDS_REVIEW` exists at all. Slow but working is a judgement call a human
might override. A broken user flow isn't.

**Pasted the failure path, not only the success path.** The full
`verify-local.sh` run verbatim — health, load, telemetry, Playwright,
`PROMOTE` — then `ROUTE_DELAY_MS=2500` producing `NEEDS_REVIEW` on a 2508 ms
p95 with the critical flow still green. A gate catching something is stronger
evidence than a gate passing.

**Named the gap unprompted.** `gcloud` wasn't installed, so the Cloud Run
scripts shipped unexecuted. Stated plainly, with the local equivalent that was
exercised.

**Declared scope.** Both intentional regressions were specified in
`docs/regressions.md` and deliberately not built, with a table of each one's
expected verdict, so `main` stayed healthy. The `ROUTE_DELAY_MS` plumbing one
of them needs shipped in that PR — groundwork in, behavior out.

**Left machine-readable handles.** `release-report.json` with `checks`, exit
codes 0/1/2, and follow-on work written into `docs/` rather than a comment
thread.

## Where the next PR should go further

PR #1 verified locally because GCP wasn't reachable. When it is, verify against
a real deployed candidate URL and paste that run. Substitutes are acceptable
when named, but the real thing, when available, is not optional.
