# Worked edits

Calibration for how hard to push. Each edit names the rule and the size of the
cut. Text is adapted from this repo's own docs.

---

## 1. The compound sentence

> **Before (43 words):** It's worth noting that the release gate runs against an
> already-deployed candidate rather than a build artifact, which is important
> because the whole point of this repo is to demonstrate that a PR can be green
> and still be unfit to promote.

> **After (24 words):** The release gate runs against an already-deployed
> candidate, never a build artifact. A PR can be green, build clean, and still
> be unfit to promote.

Three fixes: deleted the `it's worth noting that` preamble, split the `which`
clause into its own sentence, and cut `the whole point of this repo is to
demonstrate that` — the sentence demonstrates it without narrating that it's
about to.

**44% shorter, no information lost.**

---

## 2. Passive voice hiding the actor

> **Before:** The image is pushed to Artifact Registry when the branch is
> merged, and the candidate is then deployed at 0% traffic.

> **After:** On merge to `main`, `ci.yml` pushes the image to Artifact Registry.
> `release.yml` then deploys the candidate at 0% traffic.

The passive version leaves the reader guessing which workflow does what. The
active version names both, so the reader can go read them. Barely shorter —
this edit buys precision, not length.

---

## 3. Embedded list → table

> **Before:** The gate fails the release if any `@critical` Playwright spec
> fails, if the error rate reaches 1%, if p95 route latency reaches 750 ms, or
> if `/health` returns anything other than `ok`.

> **After:**
>
> The gate fails the release if any check misses its threshold:
>
> | Check | Threshold |
> | --- | --- |
> | `@critical` Playwright specs | all pass |
> | Error rate | < 1% |
> | p95 route latency | < 750 ms |
> | `GET /health` | `status: "ok"` |

Four items each carrying a threshold. A reader looking up one threshold finds
it in the table without reading the other three.

---

## 4. Buried verb plus filler

> **Before:** This script provides a description of the current traffic split
> and can be utilized in order to make a determination about whether a rollback
> is currently required.

> **After:** This script describes the current traffic split and tells you
> whether a rollback is needed.

`provides a description of` → `describes`. `utilized` → cut entirely.
`in order to` → cut. `make a determination about whether` → `tells you
whether`. `currently` → cut, since present tense already means now.

**28 words → 16.**

---

## 5. Heading and step form

> **Before:**
> ```markdown
> ### Deploying And Verifying A Candidate
>
> You'll want to first build the image, and then you should deploy it to Cloud
> Run at 0% traffic, after which the verification script can be run against the
> candidate URL that gets written to GITHUB_OUTPUT.
> ```

> **After:**
> ```markdown
> ### Deploy and verify a candidate
>
> 1. Build the image.
> 2. Deploy it to Cloud Run at 0% traffic. `scripts/deploy.sh` writes
>    `candidate_url` to `GITHUB_OUTPUT`.
> 3. Run `npm run verify` against that URL.
> ```

Title case → sentence case. `-ing` heading → bare infinitive. One sentence
carrying three ordered actions → a numbered list, each step an imperative. Code
font on the identifiers.

---

## 6. What not to cut

> **Kept as-is:** The verdict is a function of *which* checks failed, not how
> many — slow-but-working is a human judgement call, a broken user flow is not.

A 27-word sentence with an em-dash and an italic. It survives because the
length is carrying the argument: the contrast between the two clauses *is* the
point, and splitting them into two sentences would break the parallel that
makes it land.

The test is never sentence length. It's whether the length is doing work.

---

## 7. Overcorrection

> **Over-cut:** Gate runs post-deploy. Checks four things. Fails on any miss.
> Exit 2 means review.

Every rule followed, and the document is now worse. Fragments, no connective
tissue, and a reader who doesn't know what "review" means or who does it.
Google's target tone is "a knowledgeable friend," not a telegram.

> **Right:** The gate runs against the deployed candidate and checks four
> thresholds. If the app works but misses a budget, it exits 2 —
> `NEEDS_REVIEW`, a human decision rather than an automatic block.

---

## Rules of thumb

- A 30–40% cut on first-draft prose is typical. A 70% cut usually means
  information was thrown out, not filler.
- If an edit makes a sentence shorter and vaguer, revert it. Concision is not
  the goal; scannability is, and vague text is unscannable.
- When a rule and the argument conflict, the argument wins — but break the rule
  knowingly, and never break the inclusive-language or accessibility ones.
