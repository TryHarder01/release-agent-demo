# GCP setup: identity and registry

How GitHub Actions authenticates to Google Cloud for this repo, and how to
rebuild it from nothing. [deployment.md](deployment.md) covers what the
workflows *do* once they can authenticate; this covers getting them in.

There is no service account key anywhere in this setup, and adding one would be
a regression. GitHub mints a short-lived OIDC token per run and trades it for a
Google access token through Workload Identity Federation. Nothing long-lived is
stored in the repo, so nothing can leak from it.

## The pieces

| Piece | Value here | Why it exists |
| --- | --- | --- |
| Project | `warpdemo-505821` (number `638332938882`) | everything below lives in it |
| Region | `northamerica-northeast1` | Cloud Run service *and* the registry — keep them equal |
| Service account | `warpdemogha@warpdemo-505821.iam.gserviceaccount.com` | the identity Actions impersonates |
| WIF pool | `github` | trust boundary for external identities |
| OIDC provider | `github` (in that pool) | trusts GitHub's token issuer, restricted to one repo |
| Artifact Registry | `warpdemo`, Docker, standard | where `ci.yml` pushes on `main` |

Full image path:

```
northamerica-northeast1-docker.pkg.dev/warpdemo-505821/warpdemo/fleetnet-route-planner
```

## One-time setup

Run as a principal with project IAM admin. Safe to re-run — every step is
idempotent except the two `create` calls, which fail loudly if the resource is
already there.

```bash
export PROJECT_ID=warpdemo-505821
export REPO=TryHarder01/release-agent-demo
export REGION=northamerica-northeast1
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export SA_EMAIL=warpdemogha@$PROJECT_ID.iam.gserviceaccount.com

gcloud config set project $PROJECT_ID

gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

`iamcredentials` and `sts` are the ones people forget. They are what actually
perform the token exchange, and without them auth fails at run time with an
error that points at neither.

### Service account and roles

```bash
gcloud iam service-accounts create warpdemogha --display-name="GitHub Actions"

for role in roles/run.admin roles/artifactregistry.writer \
            roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" --role="$role" --condition=None
done
```

| Role | Needed by |
| --- | --- |
| `roles/artifactregistry.writer` | `ci.yml` push job |
| `roles/run.admin` | `deploy.sh`, `promote.sh` |
| `roles/iam.serviceAccountUser` | deploying a revision that runs as a service account |

### Workload Identity Federation

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'"

gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"
```

The `--attribute-condition` is the security boundary, not a formality. Google
rejects a provider without one. Drop the repo restriction and any GitHub repo on
the internet can present a token for that issuer and impersonate this service
account.

The last binding is the one that grants impersonation, and it is scoped to
`attribute.repository/TryHarder01/release-agent-demo` — a token from a different
repo maps to a principal with no binding, so the exchange fails.

### Registry

```bash
gcloud artifacts repositories create warpdemo \
  --repository-format=docker --location=$REGION
```

## GitHub configuration

```bash
gh secret set GCP_WIF_PROVIDER --body "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github"
gh secret set GCP_SERVICE_ACCOUNT --body "$SA_EMAIL"
gh variable set GCP_PROJECT --body "$PROJECT_ID"
gh variable set GCP_REGION --body "$REGION"
```

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `GCP_WIF_PROVIDER` | `projects/638332938882/locations/global/workloadIdentityPools/github/providers/github` |
| Secret | `GCP_SERVICE_ACCOUNT` | `warpdemogha@warpdemo-505821.iam.gserviceaccount.com` |
| Variable | `GCP_PROJECT` | `warpdemo-505821` |
| Variable | `GCP_REGION` | `northamerica-northeast1` |

Neither secret is confidential — both are identifiers, and access is granted by
the IAM binding rather than by knowing the string. They are secrets because the
workflows read them from `secrets.`, and consistency is worth more than
relitigating the classification.

The workflows default `GCP_PROJECT` and `GCP_REGION` in-file, so the variables
are belt and braces. The secrets have no defaults and auth fails without them.

## Verifying

```bash
gcloud iam workload-identity-pools providers describe github \
  --location=global --workload-identity-pool=github --format='value(name)'

gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:$SA_EMAIL" \
  --format="value(bindings.role)"

gcloud artifacts repositories list --location=$REGION
gh secret list && gh variable list
```

The exchange itself can only be exercised from inside a GitHub runner — it needs
a real GitHub OIDC token, so there is no local equivalent. First green auth step
in a workflow run is the proof.

## Failure modes worth knowing

**A pool or provider name is held for 30 days after deletion.** Delete `github`
and you cannot recreate it under that name until it purges. Get the name right
the first time.

**The numeric uniqueId is not the email.** `gcloud iam service-accounts list`
prints both. `google-github-actions/auth` wants
`name@project.iam.gserviceaccount.com`. The uniqueId looks plausible and fails.

**A variable is not a secret.** They are separate namespaces in GitHub. Set
`GCP_SERVICE_ACCOUNT` as a variable while the workflow reads
`secrets.GCP_SERVICE_ACCOUNT` and it resolves to empty string — no error, just an
auth step that fails on a blank account.

**Registry region and Cloud Run region should match.** Both are
`northamerica-northeast1` here. A cross-region pull works but adds cold-start
latency, and p95 latency is one of the four release gate checks — a
configuration mistake would surface as a `NEEDS_REVIEW` verdict and read as an
application regression.

**The release deploys an existing Artifact Registry image.** CI builds the image
and release deploys the commit-addressed `git-<full-commit-sha>` tag, so this
flow does not use Cloud Build or require `roles/cloudbuild.builds.editor`.

## Local gcloud

The SDK lives at `~/google-cloud-sdk`, sourced from `~/.zshrc`. It is a personal
tool, not a project dependency — nothing in the repo shells out to `gcloud`, and
CI installs its own via `google-github-actions/setup-gcloud`.

Do not install it inside the repo. It is ~445M, and an in-tree copy is one
`git add -A` away from being committed. `.gitignore` guards `google-cloud-sdk/`
and `google-cloud-cli-*.tar.gz` in case someone tries anyway.

Credentials live in `~/.config/gcloud`, separate from the SDK, so moving or
reinstalling the SDK does not require re-authenticating.
