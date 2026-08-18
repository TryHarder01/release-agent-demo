# Oz platform setup

What the release-readiness agent runs on, and how it gets read-only access to
GCP. `oz` is Warp's cloud-agent CLI; see `.claude/skills/warp-oz-cli/SKILL.md`
for command syntax.

## The three layers

Warp splits these deliberately, and they are easy to confuse:

| Layer | Defines | Ours |
| --- | --- | --- |
| **Environment** | workspace: Docker image, repos to clone, setup commands | `DemoApp` (`6E6yxZoQ6uUZCFDrQDiZ7Z`) |
| **Runner** | compute: OS, arch, vCPUs, memory | default |
| **Host** | where it executes: Warp-hosted or self-hosted | Warp-hosted |

Toolchain belongs to the environment, not the runner. A runner is worth
creating only for a different machine shape.

## The image

`oz/Dockerfile` builds `r0124x/oz-release-agent`, published public on Docker
Hub because Warp pulls environment images anonymously.

It is `warpdotdev/dev-web:latest` plus the gcloud CLI. `dev-web` already
carries Node 22, Python 3, git, the Docker client, and Chrome/Firefox — the
browsers matter, because reading telemetry is only part of the job and the
agent may need to run the Playwright critical flow itself.

```bash
docker build --platform linux/amd64 -t r0124x/oz-release-agent:latest oz/
docker push r0124x/oz-release-agent:latest
oz environment update 6E6yxZoQ6uUZCFDrQDiZ7Z --docker-image r0124x/oz-release-agent:latest --force
```

Build for `linux/amd64` explicitly. On an Apple Silicon machine the default
would be arm64, which the sandbox cannot run.

### Why an image rather than a setup command

Both work. Installing gcloud through `--setup-command` failed intermittently
during environment setup with no diagnostic beyond "Failed to run setup
command", and every retry cost minutes of run time. Baking it into the image
makes the run deterministic and starts it faster. Setup commands are still the
right tool for anything repo-specific, like `npm install`.

## Credentials

The agent authenticates from the `GCP_SA_KEY` Oz secret, injected as an
environment variable at run time. Nothing is baked into the image.

```bash
oz secret create GCP_SA_KEY --type raw-value --value-file grafana/gcp-key.json --team
```

That key is `fleetnet-grafana@warpdemo-505821.iam.gserviceaccount.com`, holding
`roles/logging.viewer` and `roles/monitoring.viewer` and nothing else. It is
**not** the deploy identity (`warpdemogha@…`), so the agent can read every
signal it needs and cannot deploy, shift traffic, or change a cloud resource.
That bound is the point, not an accident of setup: promotion stays a human
action (`scripts/promote.sh`).

The agent writes the key to a temp file, runs `gcloud auth
activate-service-account`, and deletes it.

## Run the agent

```bash
oz agent run-cloud \
  --environment 6E6yxZoQ6uUZCFDrQDiZ7Z \
  --skill 'TryHarder01/release-agent-demo:.claude/skills/release-readiness/SKILL.md' \
  --prompt "<candidate revision, candidate URL, PR number, production revision, gate verdict>" \
  --name release-readiness
```

Pass `--skill`, not `--agent`. Saved agent UIDs are rejected at run time — see
`docs/investigations/2026-08-18-oz-agent-uid-not-linked-to-runs.md`.

The prompt should carry only facts the agent would have in the real loop: which
candidate, where it is, what the gate said. Supplying the conclusion you expect
makes the run worthless as evidence.

Read results with `oz run get <id> --conversation`.

## On-call service triage agent

`fleetnet-sre-triage` investigates reports of sluggishness on a deployed
FleetNet revision. It uses the same read-only `GCP_SA_KEY` secret and
preinstalled `gcloud` CLI as the release-readiness agent.

For the demo, ask a plain-language question. The agent defaults to the FleetNet
production URL and the 60 minutes before the investigation begins:

```text
Hey, getting some reports of sluggishness from users. Do you see anything
suspicious?
```

The SRE can add a revision name, UTC incident window, or target URL when they
need to narrow the investigation. Without an override, the agent discovers
active revisions from telemetry and compares their evidence.

The agent checks Cloud Monitoring and Cloud Logging, then performs one health
request and two sequential route probes. It never resets metrics, generates
load, deploys, promotes, or changes IAM. Its recommendation is advisory; the
release gate remains the promotion-policy authority.

Create the saved agent after publishing the repository skill to GitHub. Oz
resolves skill references from the repository, not from an uncommitted local
workspace:

```bash
oz agent create \
  --name fleetnet-sre-triage \
  --description 'Read-only FleetNet Cloud Run health and sluggishness triage for on-call SREs.' \
  --environment 6E6yxZoQ6uUZCFDrQDiZ7Z \
  --base-model auto \
  --secret GCP_SA_KEY \
  --skill 'TryHarder01/release-agent-demo:.claude/skills/on-call-service-triage/SKILL.md' \
  --prompt 'Investigate FleetNet on-call reports with the on-call-service-triage skill. Default to FleetNet production, the latest 60 minutes, and revisions discovered from telemetry. Accept revision, UTC window, and URL as optional overrides. Return only an evidence-backed advisory report; never mutate cloud or repository state.'
```

To attach the skill to an existing saved agent after publishing, run:

```bash
oz agent update AGENT_UID \
  --add-skill 'TryHarder01/release-agent-demo:.claude/skills/on-call-service-triage/SKILL.md'
```
