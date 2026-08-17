# Prose tells — full catalog

Ordered by how much damage they do. §5 (content) matters most and is the only section
a regex can't help with. Each entry has a **keep** case: none of these are banned
outright, and treating them as banned is how de-slopping goes wrong.

---

## 1. Vocabulary tells

Words that are disproportionately common in LLM output relative to human writing.
A single one is nothing. Three in a paragraph is a signature.

**Abstract elevation:** delve, tapestry, testament, realm, landscape (metaphorical),
navigate (metaphorical), journey, embark, unlock, elevate, empower, foster, cultivate,
illuminate, underscore, harness, leverage, spearhead, garner, resonate, showcase.

**Empty superlatives:** pivotal, crucial, vital, paramount, invaluable, profound,
unwavering, seamless, robust, comprehensive, holistic, intricate, nuanced, meticulous,
vibrant, bustling, myriad, plethora, versatile, cutting-edge, state-of-the-art,
best-in-class, game-changing, next-level, world-class.

**Consultancy filler:** ever-evolving, fast-paced, rapidly changing, in today's world,
digital age, deep dive, key takeaway, actionable insight, value-add, at scale,
low-hanging fruit, move the needle, north star.

**Connective tics:** moreover, furthermore, additionally, notably, importantly,
ultimately, essentially, fundamentally, arguably, indeed, thus, hence.

> **Keep:** "robust" in a paper about fault tolerance. "Comprehensive" describing a test
> suite that actually is. "Navigate" when someone is navigating. Domain terms are not
> slop because an LLM likes them. Judge the sentence, never the word.

**Fix:** usually deletion, not substitution. `a robust, comprehensive solution` →
`a solution`. If the adjective carried real information, replace it with the
information: `robust` → `survives a single-node failure`.

---

## 2. Sentence frames

The highest-signal tells. These are near-diagnostic; a human writes them occasionally,
an LLM writes them constantly.

**Antithesis / false profundity**
- "It's not just X — it's Y."
- "This isn't a X. It's a Y."
- "More than just a X."
- "Not only ... but also ..."
- "X isn't about Y. It's about Z."

**Setup and reveal**
- "Here's the thing:"
- "But here's the kicker."
- "That's where X comes in."
- "The truth is, ..."
- "And that's exactly why ..."
- "Enter: X."

**Ceremonial openers**
- "In today's fast-paced world/digital landscape, ..."
- "Whether you're a beginner or a seasoned pro, ..."
- "At its core, X is ..."
- "In the world of X, ..."
- "Let's dive in / Let's explore / Let's unpack / Let's take a look at ..."
- "Have you ever wondered ...?" (rhetorical-question opener)

**Ceremonial closers**
- "In conclusion, / In summary, / To sum up," on anything under 2,000 words.
- "Remember, ..." as a closing homily.
- "By doing X, you can Y."
- "The key is to ..."
- "Happy coding!" / "I hope this helps!" / "Great question!"
- A final paragraph that restates the opening paragraph.

**Inflation of the ordinary**
- "plays a crucial/vital role in"
- "serves as a testament to"
- "stands as a"
- "is a powerful tool that"
- "when it comes to X"
- "it's worth noting that"

> **Keep:** "That's where X comes in" is fine *once*, in a piece that genuinely set up a
> gap. The tell is reflexive use, and use where nothing was actually set up.

**Fix:** cut the frame and keep only the payload. "It's not just a linter — it's a
formatter" → "It also formats."

---

## 3. Rhythm and shape

Slop's least-noticed layer. Fixing §1 and §2 without this yields text that reads
clean sentence-by-sentence and still feels synthetic.

- **Uniform sentence length.** Human prose is bursty: 4-word sentences next to 40-word
  ones. LLM prose clusters at 15-25 words with low variance. Deliberately break it.
- **No fragments.** Every sentence a complete subject-verb-object. Real writing has
  fragments. Like this one.
- **Rule of three, everywhere.** "fast, reliable, and scalable" / "plan, build, ship."
  Triads are fine occasionally and unmistakable when every list has exactly three items.
  Cut to two, or extend to four, or make them unequal in length.
- **Uniform paragraph size.** Every paragraph 3 sentences. Vary: one-line paragraphs
  carry emphasis.
- **List-ification.** Prose converted to bullets because bullets look organized. If
  the items are full sentences that flow into each other, it was a paragraph. Inverse
  also applies: a genuine enumeration crammed into prose should be a list.
- **Bold lead-ins on every bullet.** `- **Speed** — it's fast.` Fine as a glossary;
  a tell when applied to bullets that aren't definitions.
- **Emoji in headings and log lines.** 🚀 ✨ 💡 🔥 ✅. Almost never survives contact
  with a real codebase's style. Delete unless the surrounding files use them.
- **Em-dash density.** The single most-cited tell. Threshold, not prohibition: more
  than ~1 per 200 words reads as machine-written. Keep the ones doing real work
  (a genuine interruption or an appositive that commas would muddle); cut the rest to
  periods, not semicolons — a semicolon swap is a tell of its own.
- **Header inflation.** An `## H2` for every 80 words. Slop uses headers as pacing;
  headers are for navigation.
- **Symmetric coverage.** Five subtopics, five equal paragraphs, regardless of which
  one actually matters. Real writing is lopsided, because real opinions are.

---

## 4. Hedging and filler

- "It's important to note that" / "It's worth mentioning that" / "Keep in mind that"
- "That said," / "With that in mind," / "As mentioned earlier,"
- "can help to", "may potentially", "might possibly", "tends to generally"
- "in order to" (→ "to"), "due to the fact that" (→ "because"),
  "a wide variety of" (→ "many"), "at this point in time" (→ "now")
- Empty intensifiers: very, really, truly, quite, incredibly, absolutely, extremely,
  highly, significantly (when unquantified)
- Restating the question before answering it
- Defining terms the audience already knows

> **Keep:** hedges that carry information. "This may fail under network partition" is a
> precise claim about uncertainty — deleting "may" makes it false. Strip hedges that
> hedge *nothing*, keep hedges that hedge *something*.

---

## 5. Content tells (the ones that matter)

No regex finds these. They're why fluent text can still be worthless.

- **No specifics.** No numbers, names, dates, versions, or measurements anywhere. The
  strongest single indicator of slop.
- **Universal applicability.** Swap the product name and the paragraph still works.
- **Non-claims.** Assertions no one would contest: "Security is important." "Good
  documentation helps users."
- **Both-sides paralysis.** Presents the tradeoff, reaches no conclusion, recommends
  nothing. Real writing commits.
- **No stakes.** Never says what it costs, when it's the wrong choice, or what breaks.
- **Invented confidence.** Specific-sounding claims with no source — the mirror image
  of the above, and worse. If the specific isn't known, ask the user; do not supply it.
- **Summary that adds nothing.** A recap section restating what's directly above it.
- **Explaining the obvious at length** while skipping the one genuinely hard part.

**Fix:** these usually can't be fixed by editing. Either cut the passage, or tell the
user what fact is missing. "This section claims the migration is faster but has no
numbers — what's the actual before/after?" That question is more useful than any
rewrite you could produce without the answer.

---

## Quick triage

| Signal | Severity | Typical fix |
|---|---|---|
| Paragraph fails Delete + Inversion test | P0 | Cut the paragraph |
| No specifics anywhere in a claim-heavy section | P0 | Ask user for the facts |
| Ceremonial opener/closer | P1 | Cut |
| Antithesis frame ("not just X, it's Y") | P1 | Cut frame, keep payload |
| List-ification / symmetric coverage | P1 | Restructure |
| Uniform rhythm, triads everywhere | P2 | Vary lengths, break triads |
| Hedge stack, empty intensifiers | P2 | Delete words |
| Em-dash density over threshold | P2 | Cut to periods (not semicolons) |
| Single elevated-vocabulary word | P3 | Usually leave it |
