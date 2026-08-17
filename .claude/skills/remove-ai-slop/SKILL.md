---
name: remove-ai-slop
description: Strip machine-written tells out of prose and code: the vocabulary, sentence frames, list-ification, hedging, and defensive boilerplate that make text read as LLM output. Use when the user says "remove the AI slop", "de-slop this", "make this not sound like AI/ChatGPT", "this reads like an LLM wrote it", "humanize this", "tighten this up", or asks to edit a README, blog post, PR description, docs page, commit message, or code comments for that quality. Also use proactively before shipping user-facing prose you drafted.
---

# Remove AI slop

AI slop is text that is *fluent and empty*. The fix is not a find-and-replace over a
banned-word list. It's deleting what says nothing, then rewriting what remains so a
specific person with a specific opinion appears to have written it.

**The one hard rule: never do 1:1 word substitution from a blocklist.** Swapping
"delve" → "explore" or an em-dash → a semicolon leaves the slop intact and adds a
tell of its own. Cut the sentence, or rewrite the thought. If neither is warranted,
leave it alone and say why.

## Scope check (do this first, always)

Before editing, establish:

1. **What's in scope** — which files/sections. Get the whole file into context, not a
   grep of flagged lines. Slop is a property of structure, and structure is invisible
   line-by-line.
2. **What's off limits** — quotes, citations, API/CLI names, error strings tests assert
   on, legal/compliance language, someone else's writing, changelog history. Never
   silently reword any of these.
3. **How aggressive** — default is *load-bearing edits only*: cut what says nothing,
   fix what actively reads as machine-written, leave the rest. If the user wants a full
   voice rewrite they'll say so. Ask only if the two readings produce materially
   different work.
4. **House style** — read 1-2 sibling files. Matching the repo beats matching your taste.

## Workflow

### 1. Scan for candidates (cheap, deterministic)

```bash
python3 .claude/skills/remove-ai-slop/scripts/deslop.py <files...>
```

Useful flags: `--json` (machine-readable), `--stats` (structural metrics only),
`--only vocab,frame,hedge`, `--min-severity 2`, `--include-code` (scan fenced blocks
in markdown too), `--mode code` (comment/docstring tells in source files).

The scanner reports **candidates, not verdicts**. Every hit needs judgment. A clean
scan does not mean the text is good. The worst slop (§ *Content tells*) is invisible
to regex.

### 2. Pass in this order: structure, then sentences, then words

This ordering matters more than any individual fix. Cutting one empty paragraph
retires a dozen word-level flags for free; word-polishing first means polishing text
you're about to delete.

**Structural pass.** Does the piece have a point? Is it front-loaded or does it warm
up for three paragraphs? Is it a bulleted list that should be two sentences of prose
(or the reverse)? Does every subtopic get equal space regardless of importance? Does
the closing paragraph restate the opening? Delete whole sections here.

**Sentence pass.** Kill the frames in `references/prose-tells.md` §2. Break the rhythm:
LLM prose has near-uniform sentence length and no fragments. Vary it. Let one sentence
run long and the next be four words.

**Word pass.** Only now touch vocabulary, and mostly by deleting adverbs, empty
intensifiers, and hedges rather than substituting synonyms.

### 3. Apply the four litmus tests

Run these on any sentence you're unsure about:

| Test | Question | If it fails |
|---|---|---|
| **Delete** | Cut it. Did the reader lose anything? | It stays cut. |
| **Specificity** | Could this sentence appear verbatim in a piece about a *different* product? | Cut it or add the specific — a number, a name, a version, a failure mode. |
| **Inversion** | Would any sane person assert the opposite? ("We value code quality.") | Cut it. Non-claims are pure slop. |
| **Stakes** | Does it say what it costs, who it's for, or when it's wrong? | Add the tradeoff, or accept it's filler. |

The Delete test is the workhorse. **Deleting is a stronger edit than rewriting**, and
the most common failure in de-slopping is rewriting something that should have been cut.

### 4. Verify

- Re-run the scanner. Remaining hits should be *deliberate*. Be ready to defend each.
- Re-read cold. The overcorrection failure mode is real: text hacked into uniform terse
  fragments is a different flavor of machine-written. Target "the author on a good day,"
  not "generic minimalist."
- Confirm you changed no facts, no identifiers, no quoted text. Diff and check.

### 5. Report

Tell the user: what you cut and why (one line each for structural cuts), what you
flagged but kept and why, and anything you couldn't fix without knowledge you don't
have ("this paragraph has no specifics — do you have the actual latency numbers?").
The last category is the most valuable thing you produce; slop is usually a symptom of
a missing fact, and you can't invent it.

## References

Load these as needed. Don't read them all up front.

- `references/prose-tells.md` — the full catalog: vocabulary, sentence frames, rhythm
  and structure, hedging, and the content-level tells regex can't see. Includes the
  *keep* cases where each pattern is legitimately correct.
- `references/code-tells.md` — slop in source: comments that restate the code,
  ceremonial docstrings, defensive `try/except` around things that can't throw,
  single-implementation abstractions, emoji in log output, dead flexibility.
- `references/voice-preservation.md` — what NOT to touch, how to avoid flattening the
  author, and how to calibrate aggressiveness. **Read this before any large rewrite.**
- `examples/before-after.md` — worked examples with commentary on why each edit was
  made. Best calibration if you're unsure how hard to push.

## Failure modes to avoid

- **Blocklist find-and-replace.** Produces text that fails a different sniff test.
- **Em-dash panic.** Em-dashes are not the problem; *unearned* em-dashes are. Real
  writers use them. Deleting every one is itself a tell.
- **Flattening.** Stripping every hedge from genuinely uncertain claims makes the text
  wrong, not crisp. Keep qualifiers that carry information.
- **Editing the untouchable.** Reworded error strings break tests; reworded quotes are
  misattribution.
- **Silent factual drift.** "Reduced latency significantly" → "cut p99 latency by 40%"
  is only an improvement if 40% is true. Never invent the specific. Ask for it.
- **Reporting a clean scan as clean prose.** The scanner sees words. You see meaning.
