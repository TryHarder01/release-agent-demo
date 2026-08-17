# The color contract

Color in these diagrams is an **encoding with a stated key**, the same way an
axis on a chart is. If a reader cannot answer "what does blue mean here?" by
looking at the legend, the color is a bug.

## The two legends

A diagram uses exactly one legend. Mixing them makes green ambiguous — is that
node "passing" or "ours"? — and one ambiguous hue discredits every other hue on
the page.

### Legend S — Scope: *who owns and runs this?*

Used for structural diagrams (C1, C2, C3, deployment). The question a reader
brings to a structure diagram is "what can we change, and what must we live
with?" That is what hue answers.

| Class | Meaning | Fill | Stroke |
| --- | --- | --- | --- |
| `actor` | A human or autonomous agent that initiates work | `#dbe4f0` | `#41567a` |
| `owned` | A deployable unit this repo builds and ships | `#c3ddfb` | `#2264ab` |
| `internal` | A module *inside* an owned unit — same hue, lower saturation | `#e4eefc` | `#5b87bd` |
| `external` | A system the team consumes but does not build or run | `#e7e7ea` | `#87878f` |

The blue family means **we control this; a PR can change it.** Grey means
**someone else's contract; changing it means a migration, not a commit.** That
single distinction is the most decision-relevant thing on a structure diagram,
which is why it gets the strongest visual channel.

Saturation encodes altitude within the blue family: `owned` (saturated) is a
thing you deploy, `internal` (pale) is a thing inside it. So a reader can see
container-vs-component without reading a word.

### Legend R — Release state: *what did the gate conclude?*

Used only for gate, verdict, and pipeline-coverage diagrams. Hue maps 1:1 onto
the verdict vocabulary and its exit codes, so the diagram and the terminal
output agree.

| Class | Meaning | Fill | Stroke |
| --- | --- | --- | --- |
| `pass` | Check passed / `PROMOTE` / exit 0 | `#c8e6d0` | `#2e7d4f` |
| `warn` | Budget exceeded but functional / `NEEDS_REVIEW` / exit 2 | `#fbe6bf` | `#a9761b` |
| `fail` | Functionality broken / `STOP` / exit 1 | `#f6cbc8` | `#b3261e` |
| `blind` | Asserts no verdict — a stage that structurally *cannot* observe this failure, or a question node that has not concluded yet | `#e7e7ea` | `#87878f` |

`blind` is deliberately the same grey as `external`. Both mean the same thing at
a different scale: **outside the boundary of what this diagram asserts.** Grey is
the only hue shared across legends, and only because its meaning is genuinely
identical. Decision diamonds and "inputs to the gate" nodes are `blind` for the
same reason — a question is not an outcome.

## Rules

1. **Declare the legend.** One italic line under every diagram:
   `_Legend S — hue = ownership._`
2. **Color is redundant, never sole.** Every colored node also carries a glyph
   or word (`✓ PASS`, `✕ STOP`, `external`). Roughly 1 in 12 men has a color
   vision deficiency, and green/amber/red is precisely the trio they confuse;
   the diagram must survive being printed in grayscale.
3. **The glyph is plain text, not markup.** Redundant encoding is carried by
   Unicode characters inside the label (`✓`, `✕`, `!`, `—`) and by `\n` line
   breaks. Never by `<b>` or `<br/>` — see the HTML rule in
   `diagram-recipes.md`. A contract that only holds in one renderer is not a
   contract.
4. **Fixed hex, no theme conditionals.** Mermaid renders these fills on both
   light and dark backgrounds. Fills are light and text is forced dark
   (`color:#12233b`) so contrast holds either way. Never use a dark fill with
   default text.
5. **Every node gets a class — no exceptions.** A node with no `class`
   assignment inherits Mermaid's default lavender fill, which means nothing and
   reads as a fifth category. Decision diamonds are the usual casualty. If a
   node genuinely asserts nothing, that is what `blind` is for. Lint for this;
   do not eyeball it.
6. **No new hues without a written meaning.** Adding a color to a diagram means
   adding a row to this file first. If you cannot write the meaning in one
   sentence, you do not need the hue.
7. **Exhaust the free channels first.** Line style and shape are unused budget:
   - solid edge = runtime request path
   - dashed edge = build- or deploy-time action
   - `[ ]` rectangle = process or module
   - `[( )]` cylinder = state store
   - `{ }` diamond = decision
   Use these before reaching for another color.
8. **Boundaries are not colored.** Subgraphs get a near-white fill and a dashed
   stroke so grouping reads as containment, not as a fifth category.

## Copy-paste block

Structural diagrams (Legend S):

```
classDef actor    fill:#dbe4f0,stroke:#41567a,stroke-width:1.5px,color:#12233b
classDef owned    fill:#c3ddfb,stroke:#2264ab,stroke-width:1.5px,color:#12233b
classDef internal fill:#e4eefc,stroke:#5b87bd,stroke-width:1.5px,color:#12233b
classDef external fill:#e7e7ea,stroke:#87878f,stroke-width:1.5px,color:#12233b
classDef boundary fill:#fafbfd,stroke:#9db2cd,stroke-width:1px,stroke-dasharray:4 3,color:#12233b
```

Release-state diagrams (Legend R):

```
classDef pass  fill:#c8e6d0,stroke:#2e7d4f,stroke-width:1.5px,color:#12233b
classDef warn  fill:#fbe6bf,stroke:#a9761b,stroke-width:1.5px,color:#12233b
classDef fail  fill:#f6cbc8,stroke:#b3261e,stroke-width:1.5px,color:#12233b
classDef blind fill:#e7e7ea,stroke:#87878f,stroke-width:1.5px,color:#12233b
classDef boundary fill:#fafbfd,stroke:#9db2cd,stroke-width:1px,stroke-dasharray:4 3,color:#12233b
```

## Relationship to canonical C4

Standard C4 notation uses dark blue for the system in scope, mid blue for
containers, and grey for external systems. This contract keeps that convention
(blue = in scope, grey = external) but **inverts the lightness** — light fills
with dark text — because GitHub renders Mermaid over both light and dark page
backgrounds, and only a light fill with explicitly dark text is legible in both.
The semantics are C4; the values are adapted to the medium.
