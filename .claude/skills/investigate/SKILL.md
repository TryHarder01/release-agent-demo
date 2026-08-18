---
name: investigate
description: Diagnose a reported behavior, suspected bug, regression, or unexpected result and write a concise evidence-led record in `docs/investigations/`. Use for general bug and behavior investigations requiring code/runtime tracing, reproducible commands, Mermaid diagrams, findings separated from hypotheses, and explicit follow-up gaps. For a Cloud Run candidate's latency, logs, or release-gate sampling, use `diagnose-release-performance` instead.
---

# Investigate

Turn a question into a durable, evidence-led investigation record. This is
diagnosis, not implementation: do not change product code, infrastructure, or
production state unless the user separately asks for a fix.

For a candidate revision's performance, Cloud Monitoring/Logging evidence, or
release-gate coverage, use `diagnose-release-performance`; it has the
FleetNet-specific queries and safety constraints this general workflow lacks.

## Start with a bounded question

- Write one investigation file named `YYYY-MM-DD-<short-kebab-case-subject>.md` in `docs/investigations/`; use an existing investigation
  file only when the user identifies it. Maintain an index in `docs/investigations/README.md`.
- State the question, observed symptom, environment/revision, and time window.
  If an input is unknown, record it as unknown instead of guessing.
- Read the relevant code, tests, configuration, documentation, recent diffs,
  and runtime evidence before drawing a conclusion. Follow data across the
  boundary where the behavior appears: caller -> transport -> handler ->
  dependency -> response/UI.
- Prefer safe, read-only evidence. Before a command that changes state, stop
  and ask unless it is necessary, clearly in scope, and explicitly authorized.

## Work from evidence

1. Reproduce or observe the symptom as narrowly as possible. Preserve the
   exact command, inputs, relevant output, timestamps, and revision/commit.
2. Trace the actual path through source and configuration. Cite `path:line`
   for each material claim; cite URLs or query parameters for external/runtime
   evidence.
3. Separate **facts** (observed output or source behavior) from **inferences**
   (the explanation those facts support). Mark unresolved ideas as hypotheses,
   not findings.
4. Test the smallest discriminating hypothesis you can with available tools.
   Do not pad the report with every command tried; retain the commands that a
   reader needs to repeat or verify the conclusion.
5. Stop when the evidence explains the reported behavior to the available
   confidence level. Do not claim a root cause when only a correlation exists.

## Write the record

Copy `assets/investigation-template.md` into the investigation file, then
remove empty sections. Keep the final record crisp: lead with the conclusion,
use short bullets/tables, and include at least two diagrams only when they add
distinct value. Mermaid must use plain labels (no HTML) and render in standard
Markdown viewers.

Required content:

- **Conclusion** — what is happening, confidence, and user/release impact.
- **Evidence** — exact, checkable observations with source citations.
- **Trace** — a Mermaid flow showing the relevant request/data/control path.
- **Sequence** — a Mermaid sequence or timeline showing the failing/important
  interaction or state change. Use a second flow only if a sequence would
  obscure the issue.
- **Reproduce** — copy-pastable commands, prerequisites, expected result, and
  any cleanup. Redact secrets and never write real credentials into the file.
- **What seems amiss** — the suspected defect or design gap, with facts and
  confidence made explicit.
- **Next looks** — targeted checks that would raise confidence but are blocked
  by missing permission, unavailable data, environment access, or domain
  knowledge. Name the access, owner, or artifact needed; do not call absence of
  access proof that nothing is wrong.

For a clean reproduction, distinguish a command that reproduces the symptom
from one that merely inspects it. If reproduction is not possible, say why and
provide the closest observation command.

## Quality bar

- Write blamelessly about systems and conditions, never people.
- Make every conclusion traceable to an observation; label uncertainty.
- Keep commands safe by default and include the execution context they need.
- Check each Mermaid block for valid, compact syntax and ensure the report has
  no secrets, tokens, personal data, or noisy raw logs.
- End by naming the file and summarizing the conclusion in 1-3 sentences.
