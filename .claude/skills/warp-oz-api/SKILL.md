---
name: warp-oz-api
description: Integrate with Warp Oz cloud agents over the REST API. Use when implementing or debugging raw HTTP calls, webhooks, CI jobs, backend services, or scripts that use `WARP_API_KEY`, `https://app.warp.dev/api/v1`, Oz run IDs, follow-ups, or cancellation endpoints.
---

# Warp Oz REST API

Use the Oz REST API when an HTTP client is enough. In Python or TypeScript,
prefer the matching SDK for typed request models, retries, and error handling.

Set `WARP_API_KEY` in the deployment or CI secret store. Never log it, commit it,
or construct a request with it visible in process listings.

## Create and inspect a run

All requests use `https://app.warp.dev/api/v1` and Bearer authentication. Submit
the task, retain its `run_id`, then fetch it until `SUCCEEDED` or `FAILED`.

```bash
curl -sS -X POST https://app.warp.dev/api/v1/agent/run \
  -H "Authorization: Bearer $WARP_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Summarize the repository.","config":{"environment_id":"ENVIRONMENT_ID"}}'

curl -sS -H "Authorization: Bearer $WARP_API_KEY" \
  https://app.warp.dev/api/v1/agent/runs/RUN_ID

curl -sS -H "Authorization: Bearer $WARP_API_KEY" \
  https://app.warp.dev/api/v1/agent/runs
```

The configuration can set an environment, model, name, base prompt, skill, and
MCP servers. Use `name` to group runs and `skill_spec` for reusable instructions.

## Control existing work carefully

Inspect a run before changing it. Use `POST /agent/runs/{runId}/followups` to
steer it. Cancel queued or in-progress work through
`POST /agent/runs/{runId}/cancel` only with user authorization. Return the run
state and `session_link` to the caller.

Check the current schema before implementation: https://docs.warp.dev/api/.
For concepts and a working quickstart, read
https://docs.warp.dev/reference/api-and-sdk/ and
https://docs.warp.dev/reference/api-and-sdk/quickstart.
