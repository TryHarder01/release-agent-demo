---
name: google-style
description: This skill should be used when the user says "this is too verbose", "tighten this up", "make this concise", "use Google style", "too wordy", or asks to write or edit a SKILL.md, README, docs page, PR description, or code comment. Applies the Google developer documentation style guide (developers.google.com/style) — sentence-level conciseness, active voice, imperative procedures, sentence-case headings, tables over prose, and inclusive-language rules — and ships a linter that flags departures.
---

# Google developer documentation style

Google's guide optimizes for one reader: someone **scanning to find the one
thing they need**, not reading front to back. Every rule below traces to that.
Active voice names the actor without a re-read. Sentence case makes headings
scannable. Cut filler, and every surviving sentence is one the reader needed.

Apply the pass below in order. Cutting outranks rewriting at every step: a
shorter true sentence beats a smoother long one.

## The pass

### 1. Scan

```bash
python3 .claude/skills/google-style/scripts/style_lint.py <files...>
```

Flags banned words, filler, passive voice, first person, title-case headings,
`-ing` headings, directional cross-references, ambiguous dates, and sentences
over 40 words. Options: `--stats`, `--min-severity 2`, `--only inclusive`,
`--max-sentence N`, `--json`.

Treat every hit as a candidate. The linter sees words; it cannot see whether the
document says the right thing, so read the file too.

### 2. Cut

Delete before rewriting. Three passes, in this order, because each one makes the
next smaller:

1. **Delete filler words.** `just`, `simply`, `currently`, `basically`,
   `please`, `in order to`, `due to the fact that`, `note that`. Each deletion
   is free — the sentence loses nothing. Full table in
   `references/word-list.md`.
2. **Split compound sentences.** A sentence executes one idea, the way a
   statement executes one task. When a `, which` or `, and` starts a second
   claim, make it a second sentence.
3. **Free buried verbs.** `provides a description of` → `describes`. Look for
   `-tion`/`-ment`/`-ance` nouns propped up by `make`, `perform`, `provide`,
   `conduct`, `give`.

### 3. Recast

Four rewrites, applied to what survived:

| Fix | From | To |
| --- | --- | --- |
| Active voice | The merge is blocked by the gate. | The gate blocks the merge. |
| Imperative | You should run the verify script. | Run `npm run verify`. |
| Condition first | Rerun the build if it fails. | If the build fails, rerun it. |
| Specific over vague | improves performance | cuts p95 from 2508 ms to 340 ms |

Passive voice survives when the actor is genuinely unknown, irrelevant, or
better left unnamed ("Over 50 conflicts were found"). Don't convert those —
converting invents an actor who isn't there.

Reserve `we` for real claims about this project's authors and decisions. Never
as a stand-in for `you` or for the system.

Details and edge cases: `references/sentences.md`.

### 4. Restructure

Match the container to the content. Pick one:

| Content | Container |
| --- | --- |
| Steps done in order | Numbered list, each step starting with an imperative verb |
| Several items, no sequence | Bulleted list, three items minimum |
| Items with two or more attributes each | Table |
| One or two items, or ideas that flow | Prose |

Then fix the surface: sentence case in headings, serial commas, code font for
anything the reader types or that names a real identifier, bold for UI elements
only, descriptive link text, `2026-08-18` dates. Details:
`references/structure.md`.

### 5. Verify

Re-run the linter. Every remaining hit should be deliberate, and worth
defending in one sentence. Then confirm no claim moved: qualifiers carrying
real uncertainty (`usually`, `in most cases`) stay. Tightening prose must not
tighten facts.

## Where the guide is wrong for the document

Google writes reference documentation for a global audience. A document that
argues a position — a design doc, a PR body, a skill file explaining *why* a
rule exists — needs the occasional long sentence and the occasional emphatic
one. Keep those, knowingly.

Two rule clusters never bend:

- **Inclusive language.** `denylist`/`allowlist`, `primary`/`replica`,
  singular `they`. These are errors, not preferences.
- **Accessibility.** Alt text on every image, descriptive link text, and no
  `above`/`below` cross-references — position changes with rendering, and a
  screen reader has no "above."

## Scope limits

This skill judges how a document reads, not what belongs in it or whether it's
correct. A concise sentence can still be wrong. For text that reads as
machine-written rather than merely verbose — hollow openers, uniform rhythm,
list-ification — use `remove-ai-slop` instead; it targets tells, this targets
Google's rulebook. Run both when a document needs both.

Never reword quoted text, error strings tests assert on, API and CLI names, or
legal language.

## Files

- `references/word-list.md` — avoid → use table, condensed from
  [developers.google.com/style/word-list](https://developers.google.com/style/word-list),
  plus the inclusive-language replacements.
- `references/sentences.md` — one idea per sentence, subordinate-clause triage,
  nominalizations, active voice, person, and the global-audience rules
  (noun stacks, idioms, ambiguous pronouns).
- `references/structure.md` — headings, lists, tables, procedures, code font,
  accessibility, dates, and notices, each with its reason.
- `examples/before-after.md` — worked edits with commentary. Read this when
  unsure how hard to push.
- `scripts/style_lint.py` — the linter. Zero dependencies, Python 3.
