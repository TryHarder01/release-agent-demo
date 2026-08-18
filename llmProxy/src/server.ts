import express from "express";
import { ApiKeyStore, extractApiKey, keyFingerprint } from "./auth.js";
import { catalog, config } from "./config.js";
import { streamGemini } from "./adapters/gemini.js";
import { OpenAIError, sendError } from "./errors.js";
import { KeyLimiter } from "./limits.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: config.maxBodyBytes }));

const keys = new ApiKeyStore(config.projectId!, config.secretName);
const limiter = new KeyLimiter(config.requestsPerMinute, config.concurrentStreams);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/v1/models", async (req, res) => {
  const apiKey = extractApiKey(req.headers);
  const keyId = await keys.check(apiKey);
  if (!keyId) {
    console.warn(JSON.stringify({ event: "authentication_failed", path: req.path, has_authorization: Boolean(req.headers.authorization), has_x_api_key: Boolean(req.headers["x-api-key"]), key_fingerprint: keyFingerprint(apiKey) }));
    return sendError(res, new OpenAIError(401, "Invalid API key.", "authentication_error"));
  }
  res.json({ object: "list", data: catalog.map(({ target: _target, location: _location, ...model }) => model) });
});

// Warp appends /chat/completions to the Endpoint URI. Keep /v1 for curl and
// other OpenAI-compatible clients that use the conventional base path.
app.post(["/chat/completions", "/v1/chat/completions"], async (req, res) => {
  let release: (() => void) | undefined;
  try {
    const apiKey = extractApiKey(req.headers);
    const keyId = await keys.check(apiKey);
    if (!keyId) {
      console.warn(JSON.stringify({ event: "authentication_failed", path: req.path, has_authorization: Boolean(req.headers.authorization), has_x_api_key: Boolean(req.headers["x-api-key"]), key_fingerprint: keyFingerprint(apiKey) }));
      throw new OpenAIError(401, "Invalid API key.", "authentication_error");
    }
    const request = req.body as Record<string, unknown>;
    const model = catalog.find(({ id }) => id === request.model);
    if (!model) throw new OpenAIError(404, "Unknown model.", "invalid_request_error", "model_not_found");
    release = limiter.acquire(keyId);

    res.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const startedAt = performance.now();
    let firstByteAt: number | undefined;
    const stream = await streamGemini(config.projectId!, model.location, model.target, request);
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      firstByteAt ??= performance.now();
      res.write(chunk);
    }
    res.end();
    console.info(JSON.stringify({ event: "completion", key_id: keyId, model: model.id, ttfb_ms: firstByteAt ? Math.round(firstByteAt - startedAt) : null, total_ms: Math.round(performance.now() - startedAt) }));
  } catch (error) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: { message: error instanceof Error ? error.message : "Upstream request failed.", type: "server_error" } })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      sendError(res, error instanceof OpenAIError ? error : new OpenAIError(502, "Vertex request failed.", "api_error"));
    }
  } finally {
    release?.();
  }
});

app.use((_req, res) => sendError(res, new OpenAIError(404, "Not found.")));
app.listen(config.port, () => console.info(`llm-proxy listening on ${config.port}`));
