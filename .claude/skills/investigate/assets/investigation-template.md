# Investigation: <short subject>

_Investigated: YYYY-MM-DD · Scope: <environment/revision/time window>_

## Conclusion

<What happens, confidence, and impact.>

## Evidence

| Observation | Source | What it establishes |
| --- | --- | --- |
| <fact> | `<path:line>` / <query or URL> | <meaning> |

## Trace

```mermaid
flowchart LR
  A[Caller] --> B[Boundary]
  B --> C[Relevant handler]
  C --> D[Observed outcome]
```

## Sequence

```mermaid
sequenceDiagram
  participant C as Caller
  participant S as Service
  participant D as Dependency
  C->>S: Request
  S->>D: Relevant operation
  D-->>S: Result
  S-->>C: Observed response
```

## Reproduce

Prerequisites: <revision, environment, permissions, fixture>

```bash
# <what this demonstrates>
<command>
```

Expected: <observable result>

## What seems amiss

- **Fact:** <evidence-backed behavior>
- **Inference (confidence: high|medium|low):** <suspected defect or gap>

## Next looks

- <Specific check, why it matters, and the permission/access/data/knowledge needed.>
