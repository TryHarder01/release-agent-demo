export const catalog = [
  {
    id: "vertex-gemini-3-1-flash-lite",
    object: "model",
    owned_by: "vertex",
    target: "google/gemini-3.1-flash-lite",
    location: "global",
  },
  {
    id: "vertex-gemini-2-0-flash-lite",
    object: "model",
    owned_by: "vertex",
    target: "google/gemini-2.0-flash-lite",
    location: "global",
  },
] as const;

export const config = {
  port: Number(process.env.PORT ?? 8080),
  projectId: process.env.VERTEX_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT,
  secretName: process.env.API_KEYS_SECRET_NAME ?? "llm-proxy-api-keys",
  maxBodyBytes: 4 * 1024 * 1024,
  maxTokens: 64_000,
  requestsPerMinute: 20,
  concurrentStreams: 4,
};

if (!config.projectId && process.env.NODE_ENV !== "test") {
  throw new Error("Set VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT.");
}
