# Structure

Document-level and formatting conventions, from the style guide's
[highlights](https://developers.google.com/style/highlights),
[headings](https://developers.google.com/style/headings),
[procedures](https://developers.google.com/style/procedures), and
[accessibility](https://developers.google.com/style/accessibility) pages.

Every rule here serves a reader who is scanning.

## Headings

**Sentence case, always.** "Deploy the candidate," not "Deploy The Candidate."
Title case reads as a label; sentence case reads as information.

**Match the form to the section's job:**

| Section type | Form | Example |
| --- | --- | --- |
| Task | Bare infinitive verb | Deploy the candidate |
| Concept | Noun phrase | Release policy |

**Never start a heading with an `-ing` verb.** "Deploying to Cloud Run" →
"Deploy to Cloud Run." Google's reasons: present participles translate
inconsistently and cost characters. Exceptions exist where no alternative
exists (`Billing`, `Pricing`), and `-ing` is fine later in a heading.

Also avoid:

- **Stacked headings** — two headings with no text between them. If nothing
  goes between, the outer heading isn't earning its place.
- **The heading as antecedent.** A section titled "Rollback" must not open
  "This is done by…". Anyone deep-linking to that section sees only the
  sentence.
- **Numbered sections**, links inside headings, and headings that are only a
  code identifier with no descriptive words.
- **Skipped levels.** An `h3` sits under an `h2`, never directly under an `h1`.
- **Headings as pacing.** They're navigation. A three-line section usually
  belongs inside the section above it.

## Lists

Pick the container by what the content *is*:

| Content | Container |
| --- | --- |
| Steps where order matters | Numbered list |
| Multiple items, order irrelevant | Bulleted list |
| Term-and-definition pairs | Description list |
| Items with two or more attributes each | Table |
| One or two items, or ideas that flow | Prose |

**Introduce every list with a lead-in sentence ending in a colon.** Include the
word "following" where it fits naturally: "The following checks gate a
release:".

**Parallelism.** Google requires list items to match on four axes: grammar,
logical category, capitalization, and punctuation. The first item sets the
pattern; every later item has to keep it.

- Capitalize the first word of every item.
- Use a period only when the item is a full sentence — then use one on every
  item.
- In numbered lists, start every step with an imperative verb.

**Three items minimum for a bulleted list.** Two items are a sentence.

## Tables

Reach for a table as soon as an item carries more than one attribute. A
four-row table replaces four parallel sentences the reader would otherwise
compare by eye.

- Every column gets a meaningful header.
- Cap cells at about two sentences. A longer cell wants to be prose.
- Put the column the reader scans first on the left.
- Keep each column internally consistent — one column, one kind of value.

## Procedures

- One action per step. Combine only trivial sequential UI selections, using
  angle brackets: "Click **File > New > Document**."
- Start each step with an imperative verb.
- State the context or location before the action: "In the Cloud console, click
  **Deploy**."
- Mark optional steps with a leading `Optional:`, not a trailing "(optional)".
- Put the result in the same step as the action: "Click **Run**. The query
  results appear."
- Give the reason when it prevents a mistake: "Store the private key somewhere
  safe. You need it in step 7."
- Sub-steps use lowercase letters; sub-sub-steps use lowercase roman numerals.
  The parent step ends with a colon.

## Code font

Backtick anything the reader would type, or that names a real thing in the
system:

- Commands, flags, arguments: `npm run verify`, `--project=chromium`
- File paths and names: `server/src/app.js`
- Identifiers: functions, variables, env vars (`ROUTE_DELAY_MS`)
- Literal values: `true`, `null`, `200`, `status: "ok"`

Don't use code font for emphasis, product names, or generic concepts.

## Bold and italic

- **Bold** for UI elements the reader clicks: **Save**, **File > Open**.
- *Italic* sparingly, when introducing a term about to be defined.
- Neither for emphasis. A sentence that needs bold to land needs rewriting.

## Accessibility

These are requirements, not preferences.

**Alt text on every image**, describing intent rather than medium: "Route
results for Denver to Salt Lake City showing 312 mi and 5h 38m," not
"screenshot." Decorative images take empty alt text. Never put information only
inside an image — it isn't searchable, translatable, or screen-readable.

**Descriptive link text** that makes sense read in isolation, because screen
reader users navigate by jumping between links. "See the
[release policy](../../docs/release-policy.md)," never "click
[here](../../docs/release-policy.md)." Flag links that behave unexpectedly, such
as ones that download a file.

**No directional cross-references.** `above`, `below`, `right-hand side`, and
`the diagram above` all fail for screen readers and break when the page
re-renders. Use `earlier`, `the following`, `the preceding diagram`, or link
the section by name.

**Never let color or position be the only signal.** If color carries state, add
a text label or icon.

## Dates, numbers, units

- Dates: `2026-08-18`, or "August 18, 2026." Never `8/18/26` — that's a
  different day in most of the world.
- Spell out zero through nine in prose; use numerals from 10 up.
- Always use numerals with units, with a space: `5 ms`, `3 GB`. No space before
  `%` or `°`.
- Use the serial comma in every list of three or more.

## Notices

Match severity to consequence:

| Notice | Means |
| --- | --- |
| **Note:** | Useful, skippable. |
| **Caution:** | The reader could lose data or break something. |
| **Warning:** | The reader could cause harm or an irreversible failure. |

A document with five notes has none — the reader learns to skip the formatting.
