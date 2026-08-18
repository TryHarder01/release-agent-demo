# Sentences

Sentence- and clause-level technique, from Google's
[style guide](https://developers.google.com/style) and
[Technical Writing One](https://developers.google.com/tech-writing/one).

Google's framing: *sentences are statements in a program. Each one executes a
single task.*

## One idea per sentence

A sentence doing two jobs makes the reader hold the first while parsing the
second.

> **Before:** The release gate runs Playwright against the deployed candidate,
> which is important because unit tests only prove that functions work and the
> whole point of the repo is that a green test suite is not a release signal.

> **After:** The release gate runs Playwright against the deployed candidate.
> Unit tests only prove that functions work — a green test suite is not a
> release signal.

The `which` clause was a separate claim wearing a subordinate clause's clothes.

## Subordinate-clause triage

At every `which`, `that`, `because`, `whose`, `since`, ask: does this clause
*extend* the main idea or *start a new one*?

- Extends it → keep the clause.
- Starts a new idea → new sentence.

Use `that` for essential clauses, no comma: "the revision that failed"
identifies which revision. Use `which` for nonessential ones, with a comma:
"the revision, which failed," adds a fact about a revision already identified.

## Buried verbs (nominalizations)

A nominalization hides a verb inside a noun and needs a weak verb to prop it
up. Find the verb and use it.

| Buried | Freed |
| --- | --- |
| provides a description of | describes |
| performs an analysis of | analyzes |
| causes the triggering of | triggers |
| makes a determination about | determines |
| has a dependency on | depends on |
| gives consideration to | considers |
| is a reflection of | reflects |
| conducts an investigation into | investigates |

Search pattern: a `-tion`, `-ment`, `-ance`, `-ence`, or `-ity` noun next to
`make`, `perform`, `provide`, `conduct`, `give`, `carry out`, `have`.

## Active voice

Google's detection formula for passive: **form of `be` + past participle**,
often followed by `by`.

> **Passive:** The image is pushed to Artifact Registry when the branch is merged.
> **Active:** `ci.yml` pushes the image to Artifact Registry on merge to `main`.

The active version names the workflow, which the reader can go read. The
passive one leaves them guessing at who acts — and Google's main objection to
passive is exactly that: it lets the writer omit the actor, so the reader can't
tell whether they, the system, or a third party is responsible.

Imperative verbs are active, even without a stated subject. "Run the script"
has an implied `you`.

**Keep passive** in three cases the style guide names:

| Case | Example |
| --- | --- |
| The object is the point | The file is saved automatically. |
| Naming the actor would blame the reader | Over 50 conflicts were found in the file. |
| The actor is irrelevant | The database was purged in January. |

## Person

Write to the reader as `you`. In procedures, drop even that — use the
imperative.

| Avoid | Use |
| --- | --- |
| The user should run the verify script. | Run `npm run verify`. |
| We can then check the report. | Check `release-report.json`. |
| One might consider deploying first. | Deploy the candidate first. |
| It is recommended that you pin the SHA. | Pin the SHA. |

Reserve `we` for genuine first-person claims about the project's authors or
decisions: "we keep Playwright out of CI on purpose." Using `we` to mean `you`,
or to mean the system, makes the reader work out who acts.

**In a SKILL.md, prefer the bare imperative over `you`.** Skill bodies are
instructions to an agent, and Anthropic's skill-authoring guidance calls for
verb-first instructions rather than second person. Google and that guidance
agree on procedures; they differ only on explanatory prose, where `you` is
fine.

## Condition before instruction

Put the `if` first, so a reader who doesn't meet the condition can stop reading
the sentence.

> **Before:** Run `./scripts/promote.sh <revision>` to roll back if the
> candidate fails verification.
> **After:** If the candidate fails verification, run
> `./scripts/promote.sh <revision>` to roll back.

Same rule for goals: "To start a new document, click **File > New**," not
"Click **File > New** to start a new document."

## Embedded lists

A series joined by `and` or `or`, where the items have structure, is a list
hiding in a sentence. Google calls these "embedded lists" and says to convert
them.

> **Before:** The gate checks that all `@critical` Playwright specs pass, that
> the error rate is under 1%, that p95 route latency is under 750 ms, and that
> `/health` returns `ok`.

> **After:** The gate checks four things:
>
> | Check | Threshold |
> | --- | --- |
> | `@critical` Playwright specs | all pass |
> | Error rate | < 1% |
> | p95 route latency | < 750 ms |
> | `GET /health` | `status: "ok"` |

Four items each carrying a threshold is a table, not a bulleted list. See
`structure.md`.

## Global audience

Most readers of technical documentation read English as a second language, and
some of the text will be machine-translated. These rules cost nothing and help
both.

- **Plain vocabulary.** `use` not `utilize`, `start` not `commence`, `before`
  not `prior to`.
- **No idioms or figurative language.** `ballpark figure`, `back burner`,
  `out of the box`, `first-class citizen`, `under the hood`. Say the literal
  thing.
- **Unambiguous pronouns.** If `it` or `this` could refer to two nouns, repeat
  the noun. "This converts schema drift into a failure" beats "This is what
  converts it."
- **No noun stacks.** At most two nouns modifying a third. "Release candidate
  verification report generation policy" is unparseable; rewrite as "the policy
  for generating verification reports for release candidates."
- **Keep helper words.** `that`, `then`, `of` cost three characters and remove
  a parse ambiguity. "Verify the report shows" → "Verify that the report shows."
- **One term per concept.** Pick `candidate` or `revision` and use it
  everywhere, with the same capitalization. Synonym rotation reads as elegant
  variation to a native speaker and as two different things to everyone else.
- **No regional references.** Seasons differ by hemisphere; date formats and
  sports metaphors don't travel.

## Tone

Google's target: "a knowledgeable friend who understands what the developer
wants to do." Conversational, not frivolous; direct, not pedantic.

Avoid buzzwords, exclamation marks, pop-culture references, and anything that
tells the reader a task is `simple` or `easy` — if it is, the short instruction
proves it, and if it isn't, the word has insulted them.

Contractions are fine and make prose sound less stiff.
