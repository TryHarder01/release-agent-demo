---
name: mermaid-diagrams
description: Write, repair, and validate portable Mermaid diagrams for Markdown documentation. Use whenever creating or editing Mermaid flowcharts, sequence diagrams, architecture diagrams, timelines, or diagram styling and color semantics.
---

# Mermaid diagrams

Use GitHub-compatible Mermaid. Keep diagrams small enough to explain one
relationship, then put detail in the surrounding prose or table.

## Portable syntax

- Quote every flowchart label: `A["API server\nExpress"]`. Do not use HTML.
- Use plain aliases and quoted display labels in sequence diagrams:
  `participant B as "Beacon API"`.
- Keep sequence messages and notes to simple words. Do not put `;`, a second
  `:`, braces, HTML, or arrow syntax inside them. Prefer
  `text plain UTF 8` to `text/plain;charset=UTF-8`.
- Keep Mermaid control syntax out of labels. A label is content, never a place
  to embed `-->`, `->`, or a new diagram statement.
- Put one statement on each line. Keep `classDef` declarations before `class`
  assignments, and put each `subgraph` closing `end` on its own line.
- For a flowchart edge label, use `A -->|"reads metrics"| B`.

## Color is meaning

Color is an encoding, not decoration.

- Give every color a written meaning and put a compact legend immediately under
  the diagram.
- Use one semantic mapping per diagram. Do not make green mean both "ours" and
  "passed".
- Make color redundant with text, glyphs, shapes, or line styles so the
  diagram survives grayscale and color-vision differences.
- Class every colored flowchart node. Do not leave Mermaid's default fill as an
  accidental category.
- Reuse a small named `classDef` palette. Add a hue only when its meaning can
  be stated in one sentence; otherwise use shape or a solid/dashed edge.

## Validate before shipping

1. Read the block as the renderer will: check aliases, delimiters, and labels
   before checking visual polish.
2. Run this skill's renderer for every changed Markdown file:
   ```bash
   node .claude/skills/mermaid-diagrams/scripts/check-mermaid.mjs PATH --render
   ```
   For `architecture-doc`, also run its bundled `check-diagrams.mjs --render`;
   it checks the C4 palette contract in addition to syntax.
3. Inspect the rendered Markdown in the target host. A source-only review is
   not proof that a diagram parses.

For C4 architecture diagrams, also read the repository's
`architecture-doc/references/color-contract.md`; its palette is a
domain-specific extension of these rules.
