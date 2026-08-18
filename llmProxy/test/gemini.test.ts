import { describe, expect, it } from "vitest";
import { catalog } from "../src/config.js";
import { OpenAIError } from "../src/errors.js";
import { validateGeminiRequest } from "../src/adapters/gemini.js";

describe("catalog", () => {
  it("exposes the two fixed Gemini aliases", () => {
    expect(catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "vertex-gemini-3-1-flash-lite", target: "google/gemini-3.1-flash-lite" }),
      expect.objectContaining({ id: "vertex-gemini-2-0-flash-lite", target: "google/gemini-2.0-flash-lite" }),
    ]));
  });
});

describe("validateGeminiRequest", () => {
  it("accepts one streaming completion", () => {
    expect(validateGeminiRequest({ stream: true, messages: [{ role: "user", content: "hello" }] })).toMatchObject({ stream: true });
  });

  it("rejects non-streaming completions", () => {
    expect(() => validateGeminiRequest({ stream: false, messages: [] })).toThrow(OpenAIError);
  });
});
