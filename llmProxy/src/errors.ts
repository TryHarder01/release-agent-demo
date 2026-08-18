import type { Response } from "express";

export class OpenAIError extends Error {
  constructor(public status: number, message: string, public type = "invalid_request_error", public code?: string) {
    super(message);
  }
}

export function sendError(res: Response, error: OpenAIError) {
  res.status(error.status).json({ error: { message: error.message, type: error.type, code: error.code ?? null } });
}
