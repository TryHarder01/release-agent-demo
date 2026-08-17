# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is for

FleetNet is a fleet-routing dashboard that exists to be **deployed, verified,
and intentionally broken**. It is the target application for a release-agent
demo. The app is scenery; the release gate is the product.

The argument the repo is built to make: *a PR can be green, build clean, deploy
successfully, and still be unfit to promote.* Everything below serves that
argument, and changes that weaken it are regressions even when tests pass.

## Commands

```bash
npm run install:all      # root + server + web (three separate package.json files)
npm run dev              # API on :8080, Vite dev server on :5173 (proxies /api)
npm test                 # 19 unit + API tests (vitest + supertest, in server/)
npm run build            # web bundle -> web/dist, which the server then serves
npm run verify           # release gate against BASE_URL (default localhost:8080)
npm run verify:local     # full rehearsal: build image, run it, verify, tear down
npm run capture          # screenshots + walkthrough .webm and inline .mp4 -> media/
```

Tests:

```bash
npm --prefix server test -- routeEngine          # one vitest file by name filter
npm --prefix server test -- -t 'rejects'         # one test by title
npm run test:e2e                                 # full Playwright chromium project
npm run test:critical                            # only @critical (release-gating) specs
npx playwright test e2e/route.spec.js --project=chromium --headed
```

Playwright always runs against `BASE_URL` (default `http://localhost:8080`) — a
container or a deployed revision, never a dev server. There is no `webServer`
block in `playwright.config.js`; something must already be serving.

Release rehearsal, no GCP needed:

```bash
./scripts/verify-local.sh                       # -> PROMOTE (exit 0)
ROUTE_DELAY_MS=2500 ./scripts/verify-local.sh   # -> NEEDS_REVIEW (exit 2)
```

## Architecture

Single container: Express serves both the JSON API and the built React bundle
(`server/src/app.js` static-mounts `web/dist`), so there is one Cloud Run
service and one stable URL. Nothing is split across origins.

**The routing engine is fake and fully deterministic** (`server/src/routeEngine.js`).
Seeded lanes give exact numbers; unseeded lanes get stable pseudo-values from an
FNV-1a hash. This is load-bearing: it lets end-to-end assertions be exact
(`Denver → Salt Lake City` on a van is always 312 mi / 338 min → "5h 38m"), which
is why `retries: 0` is honest. Never introduce randomness or wall-clock
dependence into route output.

**Metrics are in-process** (`server/src/metrics.js`): a middleware counts
requests and keeps a rolling 500-sample latency window per route. Two rules the
policy depends on — only **5xx** counts toward `error_rate` (a 400 from a bad
request is the API working correctly), and `route_latency_ms` is hoisted to the
top level of `/metrics` because that is the number the gate keys off.
`POST /metrics/reset` exists so the verifier can zero counters and measure only
its own load.

**The frontend validates the response contract** (`web/src/api.js`). If
`distance_miles`, `duration_minutes`, or `status` is missing it throws and the UI
renders `[data-testid="route-error"]` instead of results. This is deliberate: it
converts a silent schema drift into a visible end-to-end failure. Do not "fix"
it by defaulting or optional-chaining the missing field away.

### The release gate

`scripts/verify-release.mjs` runs against an **already-deployed candidate**,
never a build artifact: health → reset counters → 40 requests at concurrency 4
across four lanes → read metrics → `playwright test --grep @critical` → verdict.

| Check | Threshold | Override |
| --- | --- | --- |
| Playwright `@critical` | all pass | — |
| Error rate | < 1% | `POLICY_MAX_ERROR_RATE` |
| p95 route latency | < 750 ms | `POLICY_MAX_P95_MS` |
| `GET /health` | `status: "ok"` | — |

| Verdict | Exit | Condition |
| --- | --- | --- |
| `PROMOTE` | 0 | everything passed |
| `NEEDS_REVIEW` | 2 | health + critical flow pass, budget exceeded |
| `STOP` | 1 | health or critical flow failed |

The verdict is a function of *which* checks failed, not how many — slow-but-working
is a human judgement call, a broken user flow is not. Every run writes
`release-report.json`, whose `checks` object maps one-to-one onto the policy
rows so a downstream agent can branch on it directly. Keep that mapping intact.

### The CI / release split — do not collapse it

| Workflow | Runs | Catches |
| --- | --- | --- |
| `ci.yml` (every PR) | unit + API tests, web build, container build | broken code |
| `release.yml` (`workflow_dispatch`) | deploy candidate, Playwright, health, error rate, p95 | broken *releases* |

**Playwright is intentionally absent from CI.** That gap is the entire point of
the demo. Moving e2e into `ci.yml` would look like an improvement and would
destroy the thing this repo exists to demonstrate.

### The visual preview comment

`ci.yml`'s `preview` job runs the container, runs `npm run capture` against it,
and posts/updates a single PR comment with the walkthrough **embedded inline**.
This is the only place PR media is produced — the `pull-request` skill's rule 5
points authors at this comment rather than having them capture and embed by
hand. Keep it that way; two capture paths means one of them is stale.

The walkthrough is a **real video player**, and getting one is narrower than it
looks. GitHub's comment sanitizer drops `<video>` tags entirely — verify with
`POST /markdown` and watch the tag come back as an empty paragraph — and it
renders a player for exactly one thing: a bare `github.com/user-attachments/
assets/<uuid>` URL **on its own line**. Wrapping that URL in markdown link
syntax leaves it a link; wrapping it in `<video>` deletes it.

`scripts/publish-media.mjs` gets those URLs by posting to
`uploads.github.com/user-attachments/assets`, the endpoint browser
drag-and-drop calls. The response asset is served from
`private-user-images.githubusercontent.com` with a per-viewer signed JWT, so it
works on a private repo with no branch, no bucket, and no public copy of
anything. The endpoint takes `.mp4`/`.mov` but not `.webm`, which is why
`capture-demo.mjs` transcodes to H.264 (`yuv420p`, `+faststart`); the `.webm`
stays in the uploaded artifact as the source copy.

That endpoint is **undocumented**. Treat a failure as expected weather: the
upload step is `continue-on-error`, uses the `MEDIA_GH_TOKEN` secret (a
fine-grained PAT verified against this endpoint) when set and `GITHUB_TOKEN`
otherwise, and the comment falls back to the artifact download link if both are
rejected. Fork PRs never receive secrets, so they always land on that fallback.

On token permissions: the endpoint returns no `x-accepted-oauth-scopes` header,
so the requirement cannot be read off the API — it was found by trial. Two
tokens are **verified** to return `201`:

| Token | Permissions | Result |
| --- | --- | --- |
| Classic PAT | `repo` (plus unrelated `gist`, `read:org`, `admin:public_key`) | works |
| Fine-grained PAT | Actions RW · Metadata R (mandatory) · Pull requests RW | works |

The fine-grained row is the informative one: at the time it was tested it
carried **no Contents permission at all** and still returned `201`, so
repository *content* access is not what gates the upload. (The token now behind
`MEDIA_GH_TOKEN` has since been given Contents as well — harmless, just wider
than the endpoint needs.) Which permission is actually load-bearing is still
unknown; narrowing it needs more tokens than were minted. `public_repo` on a
classic PAT cannot work here — the repo is private.

Auth is enforced cleanly — `401` on a bad token, `400` on none — so the CI
fallback triggers rather than posting a broken embed. Uploads are attributed to
the token's owner, so a PAT makes the preview media that human's, not the bot's.

### Deploy / promote

Candidates deploy to Cloud Run at **0% traffic** under the `candidate` tag with
their own URL (`scripts/deploy.sh`, which also writes `candidate_url` to
`GITHUB_OUTPUT`). Production keeps serving the previous revision until
`scripts/promote.sh` explicitly shifts traffic; the same script rolls back when
given a revision. A bad candidate never sees user traffic. `gcloud` is not
installed on this machine — `verify-local.sh` exercises the identical sequence
minus GCP.

`ROUTE_DELAY_MS` in `server/src/app.js` injects upstream latency into
`/api/route`. It is production plumbing for the demo, not debug code: it is how
regression B is staged.

## Pending work

`docs/regressions.md` fully specifies two regression PRs that are deliberately
**not implemented** — `main` stays healthy. Both are designed so CI stays green
and only post-deployment verification catches them (A: rename
`duration_minutes` → `duration`, expect `STOP`; B: ~2.5 s enrichment latency,
expect `NEEDS_REVIEW`). If asked to build one, follow that doc rather than
improvising, and preserve the "CI stays green" constraint — a regression that
fails CI proves nothing.

## Pull requests

**Read `.claude/skills/pull-request/SKILL.md` in full before opening, writing, or
reviewing a PR.** It is the repo's PR standard — evidence over assertion, an
explicit list of what you could not verify, a stated expected release verdict,
and visual proof for anything that renders. Claude Code loads it automatically as
a skill; other agents must open the file, so open it.

### Agent config layout

| Path | What it is |
| --- | --- |
| `CLAUDE.md` | this file — the single source of repo instructions |
| `AGENTS.md` | symlink → `CLAUDE.md`, so Codex and other AGENTS.md-based agents load the same text |
| `.claude/skills/` | skills, in the `<name>/SKILL.md` + `name`/`description` frontmatter format Claude Code and Codex share |
| `.codex` | symlink → `.claude`, a path alias only |

Note: Codex auto-discovers skills from `$CODEX_HOME/skills` (`~/.codex/skills`)
and from plugins — **not** from a repo-local `.codex/skills/`. The `.codex`
symlink makes the path resolve under either name; it does not make the skill
load itself. Under Codex the skill arrives via the pointer above, by reading the
file. Keep frontmatter to `name` and `description` only — Codex rejects
unexpected frontmatter keys, so extra fields would break portability.

## Docs

`docs/spec.md` (original brief) · `docs/release-policy.md` (gate + report schema)
· `docs/deployment.md` (GCP setup, CI credentials) · `docs/regressions.md`
(follow-on PRs).
