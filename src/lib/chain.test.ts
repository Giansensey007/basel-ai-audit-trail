import { describe, expect, it } from "vitest";
import { zurich } from "./clock";
import { canSeal, linkEvents, verifyChain } from "./chain";
import { taggedHash, utf8 } from "./hash";
import { jcs } from "./jcs";

describe("chain", () => {
  it("links events and notices a tampered byte", async () => {
    const events = await linkEvents("session-1", new Date("2026-10-25T12:00:00.000Z"), [
      { type: "intake", payload: { dossierId: "klar" } },
      { type: "decision", payload: { decision: "approve" } },
    ]);
    expect((await verifyChain(events)).ok).toBe(true);
    const tampered = events.map((event) => ({ ...event }));
    tampered[0] = { ...tampered[0], canonical: tampered[0].canonical.replace("klar", "xxxx") };
    expect((await verifyChain(tampered)).ok).toBe(false);
    expect(canSeal(["intake"])).toBe(false);
    expect(canSeal(["decision"])).toBe(true);
  });

  it("canonicalizes objects with sorted keys", () => {
    expect(jcs({ b: 1, a: "x" })).toBe('{"a":"x","b":1}');
  });

  it("writes the seal time as a Zurich clock, not a raw timestamp", () => {
    const shown = zurich("2026-10-25T10:15:00.000Z");
    expect(shown).toContain("2026");
    expect(shown).not.toContain("T");
  });

  it("tags the rule file separately from a document", async () => {
    const rules = await taggedHash("basel-audit-rules-v1", utf8("rules"));
    const doc = await taggedHash("basel-audit-doc-v1", utf8("rules"));
    expect(rules).not.toBe(doc);
  });
});
