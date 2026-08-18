---
name: warp-oz-cli
description: Run, inspect, and manage Warp Oz agents with the `oz` command-line interface. Use when a task mentions Warp CLI, Oz CLI, `oz`, `warp-cli`, cloud-agent runs, environments, agent profiles, MCP servers, or Warp skills from a terminal or shell script.
---

# Warp Oz CLI

Use `oz`; `warp-cli` is deprecated. Inspect the installed version before
prescribing flags because the CLI changes frequently:

```bash
oz --version
oz agent run --help
oz whoami --output-format json
```

If the command is not on `PATH`, install it through Warp's **Install Oz CLI
Command** action or follow the installation section of the official CLI guide.

Use `oz login` interactively. For CI, provide `WARP_API_KEY` through the CI
secret store; never print, commit, or pass the key on the command line.

## Run an agent

Choose the execution location deliberately:

- `oz agent run` runs from the local machine and accepts `--cwd`, `--profile`,
  local MCP configuration, and an optional environment.
- `oz agent run-cloud` dispatches work to a cloud environment or self-hosted
  worker. It has no local working-directory flag.

```bash
oz agent run --name "repo-review" --cwd . \
  --prompt "Review this repository and summarize the three riskiest areas."

oz agent run-cloud --environment ENVIRONMENT_ID --name "repo-review" \
  --prompt "Review this repository and summarize the three riskiest areas."
```

Use `--skill` for durable repository context and a prompt for the specific work:

```bash
oz agent run --skill skill-name --prompt "Review the release workflow."
oz agent run-cloud --environment ENVIRONMENT_ID --skill owner/repo:skill-name \
  --prompt "Review the release workflow."
```

Oz discovers skills in `.agents/skills/`, `.warp/skills/`, `.claude/skills/`,
and `.codex/skills/`. `--mcp` accepts a Warp MCP UUID, a JSON file, or inline
JSON. Add it only when the task needs those tools; use `--strict-mcp-startup`
when proceeding without them is unsafe.

## Inspect before changing state

```bash
oz model list
oz environment list
oz agent skills
oz run list --output-format json
oz run get RUN_ID --output-format json
```

Before cancelling, scheduling, creating, updating, or deleting a remote
resource, confirm the exact target and user authorization. Report run IDs,
states, session links, and environment IDs.

For current flags and installation details, read
https://docs.warp.dev/reference/cli/ and use `oz SUBCOMMAND --help`.
