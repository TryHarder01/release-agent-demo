import { OpenAIError } from "./errors.js";

type Window = { startedAt: number; requests: number; streams: number };

export class KeyLimiter {
  #windows = new Map<string, Window>();
  constructor(private requestsPerMinute: number, private concurrentStreams: number) {}

  acquire(keyId: string) {
    const now = Date.now();
    let entry = this.#windows.get(keyId);
    if (!entry || now - entry.startedAt >= 60_000) {
      entry = { startedAt: now, requests: 0, streams: 0 };
      this.#windows.set(keyId, entry);
    }
    if (entry.requests >= this.requestsPerMinute) throw new OpenAIError(429, "Rate limit exceeded.", "rate_limit_error");
    if (entry.streams >= this.concurrentStreams) throw new OpenAIError(429, "Too many active streams.", "rate_limit_error");
    entry.requests += 1;
    entry.streams += 1;
    return () => { entry!.streams -= 1; };
  }
}
