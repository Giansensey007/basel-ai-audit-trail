import { jcs } from "./jcs";

export const GENESIS = "0".repeat(64);

export function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function taggedHash(tag: string, bytes: Uint8Array): Promise<string> {
  const prefix = utf8(`${tag}\n`);
  const merged = new Uint8Array(prefix.length + bytes.length);
  merged.set(prefix, 0);
  merged.set(bytes, prefix.length);
  return sha256Hex(merged);
}

export async function hashEvent(input: {
  sessionId: string;
  seq: number;
  type: string;
  createdAt: string;
  prevHash: string;
  payload: unknown;
}): Promise<{ canonical: string; hash: string }> {
  const canonical = jcs({
    createdAt: input.createdAt,
    payload: input.payload,
    prevHash: input.prevHash,
    seq: input.seq,
    sessionId: input.sessionId,
    type: input.type,
  });
  const hash = await taggedHash("basel-audit-event-v1", utf8(canonical));
  return { canonical, hash };
}

export function stamp(base: Date, seq: number): string {
  return new Date(base.getTime() + seq).toISOString();
}
