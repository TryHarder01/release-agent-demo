---
name: warp-oz-python-sdk
description: Build Python integrations that create and manage Warp Oz cloud-agent runs using the official `oz-agent-sdk`. Use when Python code mentions `oz_agent_sdk`, `OzAPI`, `AsyncOzAPI`, `WARP_API_KEY`, or programmatic Oz agent orchestration.
---

# Warp Oz Python SDK

Install the official package with `pip install oz-agent-sdk` (Python 3.9+).
Read the current generated API reference before calling an unfamiliar method:
https://github.com/warpdotdev/oz-sdk-python/blob/main/api.md.

Set `WARP_API_KEY` in the runtime environment or secret store. The client reads
it by default. Never embed or log it.

## Create and monitor a run

```python
from oz_agent_sdk import OzAPI

client = OzAPI()
run = client.agent.run(
    prompt="Review the repository and summarize release risks.",
    config={
        "environment_id": "ENVIRONMENT_ID",
        "name": "release-risk-review",
    },
)
print(run.run_id)

status = client.agent.runs.retrieve(run.run_id)
print(status.state, status.session_link)
```

Use `config` for `environment_id`, `model_id`, `name`, `base_prompt`,
`skill_spec`, and MCP servers. Name recurring workflows. Poll `retrieve` until a
terminal state, then return the `session_link` when present.

## Async work and errors

Use `AsyncOzAPI` in concurrent services; its API is otherwise the same. Iterate
`client.agent.runs.list()` for paginated results (`async for` with the async
client). Handle `oz_agent_sdk.APIError` subclasses without exposing credentials.
Set retries and timeouts when the caller's deadline differs from the SDK default.

Inspect before sending a follow-up or calling `client.agent.runs.cancel`; both
change remote work and require user authorization.
