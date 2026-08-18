# Base image for the Oz release-readiness agent.
#
# dev-web carries Node 22, Python 3, git, the Docker client, and Chrome/Firefox,
# so the agent can run the repo's Playwright critical flow. This adds the gcloud
# CLI, which the agent needs to read Cloud Logging and Cloud Monitoring.
#
# No credentials are baked in. The agent authenticates at runtime from the
# GCP_SA_KEY Oz secret, which holds a read-only service account
# (roles/logging.viewer + roles/monitoring.viewer, never the deploy identity).
FROM warpdotdev/dev-web:latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends apt-transport-https ca-certificates gnupg curl \
  && curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg \
     | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
     > /etc/apt/sources.list.d/google-cloud-sdk.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-cloud-cli \
  && rm -rf /var/lib/apt/lists/* \
  && gcloud version
