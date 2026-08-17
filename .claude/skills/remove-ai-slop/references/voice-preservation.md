# Voice preservation — how not to ruin the text

De-slopping has two failure directions. Under-editing leaves the text sounding
machine-written. Over-editing produces something *also* machine-written — clipped,
uniform, opinion-free, every sentence the same length in the other direction. The
second failure is more common among careful editors and harder to notice, because each
individual edit looked defensible.

The target is **the author on a good day**, not a generic minimalist house style.

---

## Never touch

Editing any of these is a correctness bug, not a style call:

- **Quotations and citations.** Rewording a quote is misattribution.
- **Identifiers.** Function, flag, env var, endpoint, package, and config names — in
  prose too. `--dry-run` is not "the dry run flag" if the docs are copy-pasteable.
- **Error and log strings** that tests or downstream parsers assert on. Grep before
  touching any string literal.
- **Legal, licensing, security, and compliance language.** Precision there is
  load-bearing and often reviewed by someone else.
- **Someone else's prose** — vendored docs, third-party READMEs, other people's PR
  descriptions or commit messages, changelog history.
- **Numbers, dates, versions, benchmarks.** If a claim needs a specific and you don't
  have it, ask. Never supply a plausible-looking one.
- **Translated or non-native-speaker text**, unless asked. "Sounds non-native" is not
  "sounds like AI," and conflating them is its own problem.

---

## Keep the hedge when the hedge is the content

Strip hedges that hedge nothing:

> ~~It's worth noting that~~ the cache ~~can potentially~~ **may** go stale.

Keep hedges that encode real uncertainty:

> This **may** deadlock under concurrent writes — we haven't reproduced it, but the
> lock ordering in `flush()` isn't obviously safe.

Deleting "may" there converts an honest observation into a false claim. Same for
"approximately," "in most cases," "as of v3." Precision often looks like hedging.
Ask: does removing this word make the sentence *wrong*, or just *shorter*?

---

## Calibrating aggressiveness

| Situation | How hard to push |
|---|---|
| User drafted it themselves | Light. Preserve their phrasing; cut only what's clearly dead. Flag rather than rewrite. |
| You drafted it | Hard. It's your slop; cut freely. |
| Shipping to external users (README, docs, blog) | Hard on structure and content, careful with technical claims. |
| Internal PR description, commit message | Medium. Brevity and specifics win; voice barely matters. |
| Existing published content | Light + explicit. Show a diff, don't rewrite in place. |
| Mixed-authorship file | Match the surrounding sections, even if you'd write them differently. |

When in doubt, make the smaller edit and note the larger one you didn't make.

---

## What good non-slop writing actually has

Not "short sentences." These:

- **Specifics.** A number, a name, a version, a real failure. One concrete detail does
  more than a paragraph of adjectives.
- **A commitment.** A recommendation, a preference, a "don't do this." Slop describes
  both options and picks neither.
- **Asymmetry.** The important thing gets more space than the unimportant thing, and
  some things get skipped entirely.
- **Burstiness.** Long sentence, then a short one. Fragments where they land.
- **An audience.** Written to someone specific, assuming what they already know instead
  of re-explaining it.
- **Visible cost.** What this breaks, what it's slower at, when not to use it.

If your edit removed slop but added none of these, the text got shorter, not better.

---

## Over-correction checklist

Before you finish, verify you did not:

- [ ] Replace every em-dash with a semicolon or comma (semicolon-stuffing is a tell)
- [ ] Delete every "may" / "typically" / "usually," including the load-bearing ones
- [ ] Flatten distinct sections into one uniform voice
- [ ] Cut a transition and leave two paragraphs that no longer connect
- [ ] Strip an adjective that was carrying real technical meaning
- [ ] Convert every list back to prose, or every paragraph into a list
- [ ] Make all sentences short — uniform-terse is uniform
- [ ] Remove warmth from something meant to be warm (a welcome doc, a thank-you)
- [ ] Change what the text *claims*, not just how it says it
- [ ] Break a copy-pasteable command, path, or code sample

Read the result cold, start to finish, before reporting. Line-by-line editing hides
whether the whole thing still holds together.
