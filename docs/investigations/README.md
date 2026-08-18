# Investigations

Evidence-led diagnosis of bugs, regressions, and unexpected behavior. Each investigation includes reproductions, traces, and actionable next looks.

## Active investigations

- [**LLM proxy retired Gemini model**](2026-08-18-llm-proxy-retired-gemini-model.md) — the second advertised alias reaches retired Gemini 2.0 Flash-Lite and Vertex correctly returns 404; replace it with Gemini 3.5 Flash-Lite.
- [**Oz federation token unavailable in cloud run**](2026-08-18-oz-federation-token-unavailable.md) — a valid cloud run cannot issue a task identity token because its authenticated Oz backend connection is unavailable; GCP was never contacted.
- [**Oz platform: saved agent cannot be invoked via CLI**](2026-08-18-oz-agent-uid-not-linked-to-runs.md) — `oz agent run-cloud --agent <UID>` fails with invalid agent UID error; saved agents are non-functional for CLI workflows.
- [**client-error beacon reports lose the original browser error message**](2026-08-18-client-error-beacon-message.md) — `navigator.sendBeacon` always sends `text/plain`, `express.json()` never parses it, so `req.body?.message` is `undefined` and `JSON.stringify` drops the key before it reaches the structured log.
