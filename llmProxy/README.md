# Warp BYO-LLM demo proxy

This is a small, public Cloud Run proxy for demonstrating Warp's Bring Your
Own LLM (BYO-LLM) setting. Configure Warp with the deployed URL, a single API
key, and two low-cost models: `vertex-gemini-3-1-flash-lite` and
`vertex-gemini-2-0-flash-lite`. Warp then sends its normal
OpenAI Chat Completions requests to this service, which streams them to Gemini
on Vertex AI using the Cloud Run service account.

The demo proves one thing: a local Warp agent can use a model selected in
Warp's picker while the GCP project pays for and records the inference. It is
not a general-purpose AI gateway.

## What the fixture supports

| Surface | Behavior |
| --- | --- |
| Warp protocol | `POST /v1/chat/completions` with `stream: true` |
| Models | Fixed aliases for Gemini 3.1 Flash-Lite and Gemini 2.0 Flash-Lite |
| Tool use | The OpenAI-compatible Vertex endpoint receives Warp's tool calls directly |
| Authentication | One API key in Secret Manager, accepted as Bearer or `x-api-key` |
| Spend controls | 20 requests/minute and four active streams per key, 64K output-token cap, 4 MB request cap, five Cloud Run instances |

The fixture intentionally excludes Gemini, non-streaming calls, arbitrary
model IDs, key issuance, prompt caching, and CI/CD automation. Adding any of
those makes the demo harder to understand without proving more about Warp.

## Deploy

Run these commands from `llmProxy/`. They use Cloud Run source deployment, so
there is no repository CI workflow or manually managed Artifact Registry image.

```bash
gcloud services enable run.googleapis.com aiplatform.googleapis.com secretmanager.googleapis.com
printf 'wvp_%s\n' "$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
gcloud secrets create llm-proxy-api-keys --replication-policy=automatic
printf '%s' 'PASTE_THE_KEY' | gcloud secrets versions add llm-proxy-api-keys --data-file=-
gcloud run deploy llm-proxy --source . --region=northamerica-northeast1 --allow-unauthenticated \
  --service-account=llm-proxy@warpdemo-505821.iam.gserviceaccount.com \
  --set-env-vars=VERTEX_PROJECT_ID=warpdemo-505821,API_KEYS_SECRET_NAME=llm-proxy-api-keys \
  --max-instances=5 --min-instances=1 --concurrency=40 --timeout=3600
```

Grant the Cloud Run service account `roles/aiplatform.user` and
`roles/secretmanager.secretAccessor`. Paste the deployed URL, key, and
`vertex-gemini-3-1-flash-lite` into Warp's custom endpoint settings. Add a
second endpoint with the same URL and key for `vertex-gemini-2-0-flash-lite`.

## Add the endpoint in Warp

Get the Cloud Run URL and the token. Treat the token like a password; do not
put it in a screenshot, shell history, or source file.

```bash
gcloud run services describe llm-proxy \
  --project=warpdemo-505821 \
  --region=northamerica-northeast1 \
  --format='value(status.url)'

gcloud secrets versions access latest \
  --secret=llm-proxy-api-keys \
  --project=warpdemo-505821
```

In Warp's **Add custom endpoint** form, enter these values:

| Warp field | Value |
| --- | --- |
| API schema | `OpenAI Chat Completions` |
| Endpoint name | `Vertex Gemini 3.1 Flash-Lite` |
| Endpoint URI | The Cloud Run URL from the first command. Do not append `/v1`; Warp sends requests to `/chat/completions`. |
| API key | The `wvp_…` token from Secret Manager. |
| Model name | `vertex-gemini-3-1-flash-lite` |
| Model alias | `Vertex Gemini 3.1 Flash-Lite` |

Select **Add endpoint**. Then add the second endpoint with these values:

| Warp field | Value |
| --- | --- |
| API schema | `OpenAI Chat Completions` |
| Endpoint name | `Vertex Gemini 2.0 Flash-Lite` |
| Endpoint URI | The same Cloud Run URL. Do not append `/v1`. |
| API key | The same `wvp_…` token from Secret Manager. |
| Model name | `vertex-gemini-2-0-flash-lite` |
| Model alias | `Vertex Gemini 2.0 Flash-Lite` |

Both models appear in Warp's picker under their aliases.

## Enable the Vertex model

Gemini 3.1 Flash-Lite is the default low-cost option. Gemini 2.0 Flash-Lite is
available for a second inexpensive choice with the same proxy contract.

## Try the endpoint

Use a stream request after deployment. Replace the URL and key with the values
you created.

```bash
curl -N https://YOUR_SERVICE_URL/v1/chat/completions \
  -H 'Authorization: Bearer wvp_YOUR_KEY' \
  -H 'Content-Type: application/json' \
  --data '{
    "model": "vertex-gemini-2-0-flash-lite",
    "stream": true,
    "messages": [{"role": "user", "content": "Say hello in five words."}]
  }'
```

The response is OpenAI-compatible server-sent events ending in `data: [DONE]`.

## Verify locally

Authenticate with Application Default Credentials and set a test project:

```bash
gcloud auth application-default login
VERTEX_PROJECT_ID=warpdemo-505821 npm run dev
```

The service reads the API keys from Secret Manager. It never accepts an API key
through an environment variable.
