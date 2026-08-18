---
name: google-style
description: This skill should be used when the user says "this is too verbose", "tighten this up", "make this concise", "use Google style", "too wordy", or asks to write or edit a SKILL.md, README, docs page, PR description, or code comment. Applies the Google developer documentation style guide (developers.google.com/style) and runs a linter that flags departures.
---

# Google developer documentation style

Write for someone scanning to find one thing, not reading front to back.
[Google's guide](https://developers.google.com/style) is the reference; the
rules below are the ones that get violated in practice, and the linter is what
enforces them.

## Rules that bite

1. **Scale the document to the change.** A small change gets a paragraph and
   its evidence, not a section per point. Headings are rooms, and a room wants
   furniture — so don't build rooms you can't fill.
2. **Cut before rewriting.** Delete `just`, `simply`, `currently`, `basically`,
   `please`, `note that`, `in order to`, `due to the fact that`. Each deletion
   is free.
3. **One idea per sentence.** When a `, which` or `, and` starts a second
   claim, make it a second sentence.
4. **Active voice and the imperative.** "The gate blocks the merge," not "the
   merge is blocked." "Run `npm run verify`," not "you should run it." Keep
   passive only when the actor is unknown, irrelevant, or better unnamed.
5. **Free buried verbs.** `provides a description of` → `describes`.
6. **Match the container to the content.** Ordered steps → numbered list, each
   starting with an imperative verb. Items with two or more attributes → table.
   Two items, or ideas that flow → prose. Never a bulleted list of one thing.
7. **Sentence case headings, no `-ing` opener.** "Deploy to Cloud Run," not
   "Deploying To Cloud Run."

## The heading test

**Could this heading appear unchanged in a different document?** If yes, it's a
label, not information — "Key decisions," "Overview," "The decision worth
reviewing." Name what the section holds instead: "Where Google and
skill-authoring guidance conflict."

Exception: conventional slots a standard defines (`Verification` and `Notes` in
this repo's PR template, `Installation` in a README). Readers navigate to those
by name, so predictability beats novelty.

## Non-negotiable

Inclusive language (`denylist`/`allowlist`, `primary`/`replica`, singular
`they`) and accessibility (alt text, descriptive link text, no `above`/`below`
cross-references). These are errors, not preferences. The arbitrary long tail
lives in `references/word-list.md` — consult it rather than guessing.

## Run the linter

```bash
python3 .claude/skills/google-style/scripts/style_lint.py <files...>
```

Options: `--stats`, `--min-severity 2`, `--only inclusive`, `--max-sentence N`,
`--json`. It reports candidates, never verdicts, and never auto-replaces. A
clean run means the words check out, not that the document says the right
thing.

Remaining hits should be deliberate and defensible in one sentence. Prose that
argues a position may need a long sentence or an emphatic one — break the rule
knowingly, but never the inclusive-language or accessibility ones.

## Scope

This judges how a document reads, not what belongs in it or whether it's
correct. For text that reads as machine-written rather than merely verbose, use
`remove-ai-slop`. Never reword quoted text, error strings tests assert on, API
names, or legal language.

`examples/before-after.md` calibrates how hard to push.
