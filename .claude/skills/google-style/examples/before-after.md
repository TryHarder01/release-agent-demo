# Worked edits

Calibration for how hard to push.

## Compound sentence

> **Before (43 words):** It's worth noting that the release gate runs against an
> already-deployed candidate rather than a build artifact, which is important
> because the whole point of this repo is to demonstrate that a PR can be green
> and still be unfit to promote.

> **After (24 words):** The release gate runs against an already-deployed
> candidate, never a build artifact. A PR can be green, build clean, and still
> be unfit to promote.

Deleted the `it's worth noting that` preamble, split the `which` clause into its
own sentence, and cut `the whole point of this repo is to demonstrate that` —
the sentence demonstrates it without announcing that it's about to.

## What not to cut

> **Kept:** The verdict is a function of *which* checks failed, not how many —
> slow-but-working is a human judgement call, a broken user flow is not.

27 words, an em-dash, an italic. It survives because the contrast between the
clauses *is* the argument, and splitting it would break the parallel that makes
it land. The test is never length. It's whether the length is doing work.

## Overcorrection

> **Over-cut:** Gate runs post-deploy. Checks four things. Fails on any miss.
> Exit 2 means review.

Every rule followed, document now worse. A reader doesn't learn what "review"
means or who does it. Google's target is "a knowledgeable friend," not a
telegram.

> **Right:** The gate runs against the deployed candidate and checks four
> thresholds. If the app works but misses a budget, it exits 2 —
> `NEEDS_REVIEW`, a human decision rather than an automatic block.

## Rule of thumb

A 30–40% cut on first-draft prose is typical. A 70% cut usually means
information went out with the filler. If an edit makes a sentence shorter and
vaguer, revert it — scannability is the goal, and vague text is unscannable.
