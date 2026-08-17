---
name: architecture-doc
description: Generate or refresh ARCHITECTURE.md — a C4-layered architecture document whose Mermaid diagrams use a fixed, documented color contract where every hue carries meaning. Use when asked to create, update, or refresh an architecture doc, architecture diagrams, or a C4 model of the codebase.
---

# Architecture doc

Produce `ARCHITECTURE.md`: a C4-layered description of the system with Mermaid
diagrams that use color as an **encoding**, not decoration.

The whole point of this skill is the constraint in `references/color-contract.md`.
A diagram where nodes are colored because color is pretty is worse than a diagram
with no color at all — it invites the reader to infer a grouping that does not
exist. Read that reference before writing any diagram.

## Inputs

- **Target path** — default `ARCHITECTURE.md` at the repo root. Use an existing
  path if the repo already has one.
- **Mode** — *generate* (no file yet) or *refresh* (file exists). Detect this
  yourself; do not ask.

## Procedure

### 1. Survey before drawing

Never draw from the README alone; READMEs describe intent, diagrams must
describe the code. Establish, from files:

```bash
git ls-files | sed 's|/[^/]*$||' | sort -u   # the shape of the tree
```

Then read, in this order, whatever exists:

| Question | Where the answer actually lives |
| --- | --- |
| What deployable units exist? | `Dockerfile`, `docker-compose*`, `*.tf`, `deploy*` scripts, k8s manifests |
| What runs at runtime? | server entrypoints, route definitions, `package.json` scripts |
| What is external vs. ours? | dependency manifests, SDK clients, env vars naming a vendor |
| What are the seams? | test dirs, contract/validation code, CI workflow files |
| What decisions are load-bearing? | comments explaining *why*, ADRs, `docs/` |

Write down, before drawing: the list of **containers** (independently
deployable/runnable things) and the list of **external systems** (things the
team does not build). Those two lists drive every color choice.

### 2. Choose which levels to draw

Draw only levels that carry information for this repo.

- **C1 Context** — always. Actors and external systems around one box.
- **C2 Container** — always, unless there is exactly one process and no browser.
- **C3 Component** — only for the container where the interesting logic lives.
  One C3 diagram, not one per container.
- **Deployment / runtime** — whenever release or traffic topology is
  non-trivial (blue-green, canary, traffic splits, queues).
- **A domain-specific diagram** — whenever the repo's actual thesis is not
  structural. A release-gated repo needs its gate drawn; a data pipeline needs
  its flow drawn. This is usually the most valuable diagram in the file.

C4 depth rule: never mix altitudes inside one diagram. If a box in a C2 diagram
is a function, the diagram is wrong.

### 3. Apply the color contract

Read `references/color-contract.md` in full and copy the `classDef` block
verbatim. Non-negotiables from it:

- Two legends only — **Scope** (who owns/runs this) and **State** (what the
  release gate concluded). Never mix them in one diagram.
- Every diagram states which legend it uses, immediately below it.
- Color is always **redundant** — a colored node also carries a text token
  (`✓`, `✕`, `PROMOTE`, `external`) so the diagram survives grayscale printing
  and color-vision deficiency.
- Never introduce a hue that is not in the contract. If a distinction needs
  making and no hue covers it, use shape or line style, or add the hue to the
  contract file with a written meaning.
- **No HTML in Mermaid labels.** No `<br/>`, `<b>`, `<i>`, or any tag. Use `\n`
  for line breaks and plain Unicode glyphs for markers. HTML labels only render
  when the host enables `htmlLabels`; they print literally under strict security
  settings and break SVG export.

`references/diagram-recipes.md` has a working Mermaid template per level with
the classDefs already inlined. Start from those.

### 4. Write the file

Structure (skip sections that would be empty):

1. Title + provenance stamp (see below)
2. **What this system is** — three sentences, no diagram
3. **Reading the diagrams** — the legend, rendered as a Mermaid diagram itself
4. C1 → C2 → C3, each with one diagram and a short table of the elements
5. Deployment / runtime topology
6. The domain-specific diagram
7. **Key decisions** — hand-written, load-bearing choices and their tradeoffs
8. **Where things live** — path → responsibility table

Bound every diagram to reality: after each one, a table naming the actual files
or services each box corresponds to. A diagram that cannot be traced to paths is
a drawing, not documentation.

### 5. Refresh semantics

**Never put HTML comment markers in the file.** They would work, but any HTML in
a Markdown file makes editors treat it as code-only and disables rich editing.
The document must stay pure Markdown.

Sections are anchored by their `##` heading instead. A section is the heading
line through to the next `##`. On refresh:

- **Regenerate** the body of each generated section, matching on its heading
  text.
- **Preserve verbatim** `## Key decisions` — that section is human-authored and
  is never rewritten. If a decision there is clearly now obsolete, append a
  flagged note; do not delete it.
- **Preserve** any `##` section you did not author. An unrecognized heading is
  someone's addition, not drift to clean up.
- If a heading you expected is missing, the user probably renamed it. Do not
  re-add a duplicate — reconcile against the closest match and say so in the
  report.
- Update the provenance stamp:
  `_Generated by the `architecture-doc` skill from <short-sha> on <YYYY-MM-DD>._`
- Report a diff summary to the user: which sections changed and why. If nothing
  structural changed, say so rather than churning the file.

### 6. Validate before reporting done

Run the bundled checker — do not eyeball this:

```bash
node .claude/skills/architecture-doc/scripts/check-diagrams.mjs ARCHITECTURE.md
node .claude/skills/architecture-doc/scripts/check-diagrams.mjs ARCHITECTURE.md --render
```

It catches the failures that are invisible in source: HTML tags in labels,
**unclassed nodes** (they render in Mermaid's default lavender — an unexplained
fifth color), `classDef` names outside the contract, and missing legend lines.
`--render` additionally parses every block in headless Chromium.

Then check by hand what a script cannot:

- [ ] Every box traces to a real path or a real external service.
- [ ] No altitude mixing within a diagram.
- [ ] Every colored node carries a non-color token (`✓`, `✕`, `external`).
- [ ] The two legends are not mixed inside one diagram.
- [ ] The provenance stamp matches `git rev-parse --short HEAD`.
- [ ] The file contains no HTML anywhere, comments included — HTML puts
      Markdown editors into code-only mode.

If you can render a diagram to an image, **look at it**. Source review does not
surface default-fill nodes, overlapping edges, or a legend that laid out in the
wrong order.
