import { GENESIS, hashEvent, stamp } from "./hash";
import type { ChainEvent } from "./types";

export type StoredEvent = {
  seq: number;
  type: string;
  createdAt: string;
  prevHash: string;
  hash: string;
  canonical: string;
};

export async function verifyChain(events: StoredEvent[]): Promise<{ ok: boolean; firstBad: number | null }> {
  let prev = GENESIS;
  for (const event of events) {
    if (event.prevHash !== prev) return { ok: false, firstBad: event.seq };
    const again = await hashEvent({
      sessionId: readSessionId(event.canonical),
      seq: event.seq,
      type: event.type,
      createdAt: event.createdAt,
      prevHash: event.prevHash,
      payload: readPayload(event.canonical),
    });
    if (again.canonical !== event.canonical || again.hash !== event.hash) return { ok: false, firstBad: event.seq };
    prev = event.hash;
  }
  return { ok: true, firstBad: null };
}

function readSessionId(canonical: string): string {
  const parsed = JSON.parse(canonical) as { sessionId: string };
  return parsed.sessionId;
}

function readPayload(canonical: string): unknown {
  const parsed = JSON.parse(canonical) as { payload: unknown };
  return parsed.payload;
}

export function canSeal(types: string[]): boolean {
  return types.includes("decision");
}

export async function linkEvents(
  sessionId: string,
  base: Date,
  parts: { type: string; payload: unknown }[],
): Promise<ChainEvent[]> {
  const events: ChainEvent[] = [];
  let prev = GENESIS;
  for (let index = 0; index < parts.length; index += 1) {
    const seq = index + 1;
    const createdAt = stamp(base, seq);
    const { canonical, hash } = await hashEvent({
      sessionId,
      seq,
      type: parts[index].type,
      createdAt,
      prevHash: prev,
      payload: parts[index].payload,
    });
    events.push({
      sessionId,
      seq,
      type: parts[index].type,
      createdAt,
      prevHash: prev,
      payload: parts[index].payload,
      canonical,
      hash,
    });
    prev = hash;
  }
  return events;
}

export function sealHash(events: StoredEvent[]): string | null {
  const seal = [...events].reverse().find((event) => event.type === "seal");
  return seal?.hash ?? null;
}
