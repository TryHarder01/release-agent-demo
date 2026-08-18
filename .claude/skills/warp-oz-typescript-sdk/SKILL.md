---
name: warp-oz-typescript-sdk
description: Build TypeScript or JavaScript integrations that create and manage Warp Oz cloud-agent runs using the official `oz-agent-sdk`. Use when code mentions `oz-agent-sdk`, `OzAPI`, `WARP_API_KEY`, or programmatic Oz agent orchestration from Node.js or another fetch-compatible runtime.
---

# Warp Oz TypeScript SDK

Install the official package with `npm install oz-agent-sdk`. Read the current
generated API reference before calling an unfamiliar method:
https://github.com/warpdotdev/oz-sdk-typescript/blob/main/api.md.

Set `WARP_API_KEY` in the runtime environment or secret store. The client reads
it by default. Never embed or log it.

## Create and monitor a run

```ts
import OzAPI from 'oz-agent-sdk';

const client = new OzAPI();
const run = await client.agent.run({
  prompt: 'Review the repository and summarize release risks.',
  config: {
    environment_id: 'ENVIRONMENT_ID',
    name: 'release-risk-review',
  },
});
console.log(run.run_id);

const status = await client.agent.runs.retrieve(run.run_id);
console.log(status.state, status.session_link);
```

Use `config` for `environment_id`, `model_id`, `name`, `base_prompt`,
`skill_spec`, and MCP servers. Name recurring workflows. Poll `retrieve` until a
terminal state, then return the `session_link` when present.

## Errors, retries, and pagination

Handle API failures with `OzAPI.APIError`. The SDK retries connection failures,
408, 409, 429, and 5xx responses twice by default. Set `maxRetries` and `timeout`
on the client or request when the caller has different limits. Iterate paginated
runs with `for await (const run of client.agent.runs.list())`.

Inspect before calling `client.agent.runs.submitFollowup` or
`client.agent.runs.cancel`; both change remote work and require user
authorization.
