import { GoogleAuth } from "google-auth-library";
import { OpenAIError } from "../errors.js";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

export async function streamGemini(projectId: string, location: string, target: string, body: unknown) {
  const request = validateGeminiRequest(body);
  const token = await auth.getAccessToken();
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, model: target }),
  });
  if (!response.ok) throw new OpenAIError(response.status, await response.text(), "api_error");
  if (!response.body) throw new OpenAIError(502, "Vertex returned an empty stream.", "api_error");
  return response.body;
}

export function validateGeminiRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new OpenAIError(400, "Request body must be an object.");
  const request = body as Record<string, unknown>;
  if (request.stream !== true) throw new OpenAIError(400, "Only stream: true is supported.");
  if (request.n !== undefined && request.n !== 1) throw new OpenAIError(400, "n greater than 1 is unsupported.");
  if (!Array.isArray(request.messages)) throw new OpenAIError(400, "messages is required.");

  return request;
}
