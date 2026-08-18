import { createHash, timingSafeEqual } from "node:crypto";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const cacheMs = 5 * 60 * 1000;

export class ApiKeyStore {
  #keys: Buffer[] = [];
  #expiresAt = 0;
  #client = new SecretManagerServiceClient();

  constructor(private readonly projectId: string, private readonly secretName: string) {}

  async check(value: string | undefined): Promise<string | undefined> {
    if (!value) return undefined;
    if (Date.now() >= this.#expiresAt) await this.refresh();
    const candidate = Buffer.from(value);
    const accepted = this.#keys.some((key) => key.length === candidate.length && timingSafeEqual(key, candidate));
    return accepted ? createHash("sha256").update(value).digest("hex").slice(0, 8) : undefined;
  }

  private async refresh() {
    const name = `projects/${this.projectId}/secrets/${this.secretName}/versions/latest`;
    const [version] = await this.#client.accessSecretVersion({ name });
    const text = version.payload?.data?.toString("utf8") ?? "";
    this.#keys = text.split(/\r?\n/).filter(Boolean).map((key) => Buffer.from(key));
    this.#expiresAt = Date.now() + cacheMs;
  }
}

export function extractApiKey(headers: Record<string, string | string[] | undefined>) {
  const auth = headers.authorization;
  const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
  const apiKey = headers["x-api-key"];
  return bearer ?? (typeof apiKey === "string" ? apiKey : undefined);
}

export function keyFingerprint(value: string | undefined) {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 8) : undefined;
}
