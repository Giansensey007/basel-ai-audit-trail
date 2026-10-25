import dossiersFile from "../tool/dossiers.json";
import goldFile from "../tool/gold.json";
import rulesFile from "../tool/rules.json";
import schemaFile from "../tool/schema.json";
import templatesFile from "../tool/templates.json";
import { canSeal, linkEvents } from "./lib/chain";
import { zurich } from "./lib/clock";
import { agreementCount, derive, pruefvermerk, sameIdSet } from "./lib/derive";
import { hashEvent, taggedHash, utf8 } from "./lib/hash";
import { jcs } from "./lib/jcs";
import { chooseSegments, DAILY_CAP, IP_CAP, safeError } from "./lib/model";
import type { Dossier, DossiersFile, GoldFile, RulesFile, SchemaFile, TemplatesFile } from "./lib/types";

const dossiers = dossiersFile as DossiersFile;
const schema = schemaFile as SchemaFile;
const rules = rulesFile as RulesFile;
const templates = templatesFile as TemplatesFile;
const gold = goldFile as GoldFile;

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  OPENROUTER_API_KEY: string;
  OPENROUTER_MODEL?: string;
}

type SessionRow = {
  id: string;
  dossier_id: string;
  opened_at: string;
  status: string;
  error: string | null;
  idempotency_key: string;
  reread_json: string | null;
  reread_count: number;
};

type EventRow = {
  seq: number;
  type: string;
  canonical_json: string;
  prev_hash: string;
  hash: string;
  created_at: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handle(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

async function handle(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    if (request.method === "POST" && url.pathname === "/api/sessions") return openSession(request, env);
    const reread = url.pathname.match(/^\/api\/sessions\/([^/]+)\/reread$/);
    if (request.method === "POST" && reread) return rereadSession(request, env, reread[1]);
    const decision = url.pathname.match(/^\/api\/sessions\/([^/]+)\/decision$/);
    if (request.method === "POST" && decision) return decide(request, env, decision[1]);
    const read = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (request.method === "GET" && read) return json(await sessionPayload(env, read[1]));
    return json({ error: "Nicht gefunden." }, 404);
  } catch (error) {
    return json({ error: safeError(error) }, 500);
  }
}

async function openSession(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { dossierId?: string } | null;
  const dossier = dossiers.dossiers.find((item) => item.id === body?.dossierId);
  if (!dossier) return json({ error: "Unbekanntes Dossier." }, 400);
  const key = request.headers.get("idempotency-key")?.trim() || "";
  if (!key || key.length > 80) return json({ error: "Idempotenzschlüssel fehlt." }, 400);
  const existing = await env.DB.prepare("SELECT * FROM sessions WHERE idempotency_key = ?").bind(key).first<SessionRow>();
  if (existing) return existing.status === "ready" ? json(await sessionPayload(env, existing.id)) : json({ id: existing.id, status: existing.status, error: existing.error }, existing.status === "error" ? 502 : 202);
  const id = crypto.randomUUID();
  const openedAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO sessions (id, dossier_id, opened_at, status, idempotency_key, reread_count) VALUES (?, ?, ?, 'reading', ?, 0)",
    )
      .bind(id, dossier.id, openedAt, key)
      .run();
  } catch {
    const raced = await env.DB.prepare("SELECT * FROM sessions WHERE idempotency_key = ?").bind(key).first<SessionRow>();
    if (!raced) throw new Error("Die Sitzung konnte nicht geöffnet werden.");
    return raced.status === "ready" ? json(await sessionPayload(env, raced.id)) : json({ id: raced.id, status: raced.status, error: raced.error }, raced.status === "error" ? 502 : 202);
  }
  try {
    await assertBudget(env, request);
    const model = env.OPENROUTER_MODEL || "openai/gpt-6.1-sol";
    const chosen = await chooseSegments({ apiKey: env.OPENROUTER_API_KEY, model, dossier, schema });
    const derivation = derive({ dossier, schema, rules, templates, picked: chosen.segmentIds });
    const base = new Date();
    const events = await linkEvents(id, base, [
      { type: "intake", payload: { dossierId: dossier.id, documents: await documentHashes(dossier) } },
      {
        type: "extraction",
        payload: {
          model,
          seed: 510,
          segmentIds: chosen.segmentIds,
          promptHash: await taggedHash("basel-audit-prompt-v1", utf8(chosen.prompt)),
          responseHash: await taggedHash("basel-audit-response-v1", utf8(chosen.raw)),
        },
      },
      {
        type: "derivation",
        payload: {
          ...derivation,
          rulesHash: await taggedHash("basel-audit-rules-v1", utf8(jcs(rules))),
          schemaHash: await taggedHash("basel-audit-schema-v1", utf8(jcs(schema))),
        },
      },
    ]);
    await env.DB.batch([
      ...events.map((event) =>
        env.DB.prepare(
          "INSERT INTO events (session_id, seq, type, canonical_json, prev_hash, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).bind(event.sessionId, event.seq, event.type, event.canonical, event.prevHash, event.hash, event.createdAt),
      ),
      env.DB.prepare("UPDATE sessions SET status = 'ready', error = NULL WHERE id = ?").bind(id),
    ]);
    return json(await sessionPayload(env, id));
  } catch (error) {
    const message = safeError(error);
    await env.DB.prepare("UPDATE sessions SET status = 'error', error = ? WHERE id = ?").bind(message, id).run();
    const status = message.includes("Tageslimit") ? 429 : 502;
    return json({ id, status: "error", error: message }, status);
  }
}

async function rereadSession(request: Request, env: Env, id: string): Promise<Response> {
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
  if (!session) return json({ error: "Sitzung fehlt." }, 404);
  if (session.reread_json) return json(JSON.parse(session.reread_json));
  const claimed = (await env.DB.prepare("UPDATE sessions SET reread_count = reread_count + 1 WHERE id = ? AND reread_count = 0")
    .bind(id)
    .run()) as { meta?: { changes?: number } };
  if (!claimed.meta?.changes) return json({ error: "Eine erneute Lesung ist schon gelaufen." }, 409);
  const dossier = mustDossier(session.dossier_id);
  try {
    return await runReread(request, env, id, dossier);
  } catch (error) {
    await env.DB.prepare("UPDATE sessions SET reread_count = 0 WHERE id = ? AND reread_json IS NULL").bind(id).run();
    throw error;
  }
}

async function runReread(request: Request, env: Env, id: string, dossier: Dossier): Promise<Response> {
  await assertBudget(env, request);
  const model = env.OPENROUTER_MODEL || "openai/gpt-6.1-sol";
  const chosen = await chooseSegments({ apiKey: env.OPENROUTER_API_KEY, model, dossier, schema });
  const events = await loadEvents(env, id);
  const extraction = events.find((event) => event.type === "extraction");
  const sealedIds = extraction ? ((JSON.parse(extraction.canonical_json) as { payload: { segmentIds: Record<string, string[]> } }).payload.segmentIds) : {};
  const fieldIds = schema.fields.map((field) => field.id);
  const comparisons = fieldIds.map((fieldId) => ({
    id: fieldId,
    match: sameIdSet(sealedIds[fieldId] ?? [], chosen.segmentIds[fieldId] ?? []),
  }));
  const result = {
    match: comparisons.every((item) => item.match),
    fields: comparisons,
    segmentIds: chosen.segmentIds,
  };
  await env.DB.prepare("UPDATE sessions SET reread_json = ? WHERE id = ?")
    .bind(JSON.stringify(result), id)
    .run();
  return json(result);
}

async function decide(request: Request, env: Env, id: string): Promise<Response> {
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
  if (!session || session.status !== "ready") return json({ error: "Die Sitzung ist nicht bereit." }, 409);
  const body = (await request.json().catch(() => null)) as { name?: string; comment?: string; decision?: string } | null;
  const name = body?.name?.trim() ?? "";
  const comment = (body?.comment ?? "").trim();
  const decision = body?.decision === "approve" || body?.decision === "reject" ? body.decision : null;
  if (!decision || name.length < 1 || name.length > 200 || comment.length > 500) {
    return json({ error: "Name und Entscheidung werden gebraucht." }, 400);
  }
  const existing = await loadEvents(env, id);
  if (existing.some((event) => event.type === "seal")) return json(await sessionPayload(env, id), 409);
  if (!canSeal([...existing.map((event) => event.type), "decision"])) return json({ error: "Ohne Entscheidung kein Siegel." }, 409);
  const derivationEvent = existing.find((event) => event.type === "derivation");
  const prev = existing[existing.length - 1];
  if (!derivationEvent || !prev) return json({ error: "Ableitung fehlt." }, 409);
  const derived = (JSON.parse(derivationEvent.canonical_json) as { payload: { recommendation: "book" | "hold" } }).payload;
  const decisionAt = new Date().toISOString();
  const sealAt = new Date(Date.now() + 1).toISOString();
  const text = pruefvermerk({ templates, recommendation: derived.recommendation, decision, name, time: zurich(decisionAt) });
  const decisionPayload = { decision, reviewerClaim: name, comment };
  const sealPayload = {
    pruefvermerk: text,
    pruefvermerkHash: await taggedHash("basel-audit-pruefvermerk-v1", utf8(text)),
    decision,
    reviewerClaim: name,
  };
  const decisionHash = await hashEvent({
    sessionId: id,
    seq: prev.seq + 1,
    type: "decision",
    createdAt: decisionAt,
    prevHash: prev.hash,
    payload: decisionPayload,
  });
  const sealHashed = await hashEvent({
    sessionId: id,
    seq: prev.seq + 2,
    type: "seal",
    createdAt: sealAt,
    prevHash: decisionHash.hash,
    payload: sealPayload,
  });
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO events (session_id, seq, type, canonical_json, prev_hash, hash, created_at) VALUES (?, ?, 'decision', ?, ?, ?, ?)",
      ).bind(id, prev.seq + 1, decisionHash.canonical, prev.hash, decisionHash.hash, decisionAt),
      env.DB.prepare(
        "INSERT INTO events (session_id, seq, type, canonical_json, prev_hash, hash, created_at) VALUES (?, ?, 'seal', ?, ?, ?, ?)",
      ).bind(id, prev.seq + 2, sealHashed.canonical, decisionHash.hash, sealHashed.hash, sealAt),
    ]);
  } catch {
    return json(await sessionPayload(env, id), 409);
  }
  return json(await sessionPayload(env, id));
}

async function sessionPayload(env: Env, id: string) {
  const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
  if (!session) return { error: "Sitzung fehlt." };
  const events = await loadEvents(env, id);
  const dossier = mustDossier(session.dossier_id);
  const derivationEvent = events.find((event) => event.type === "derivation");
  const accepted = derivationEvent
    ? ((JSON.parse(derivationEvent.canonical_json) as { payload: { accepted: Record<string, string[]> } }).payload.accepted)
    : {};
  const score = agreementCount(accepted, gold.readings[dossier.id] ?? {}, schema.fields.map((field) => field.id));
  return {
    session: {
      id: session.id,
      dossierId: session.dossier_id,
      openedAt: session.opened_at,
      status: session.status,
      error: session.error,
      reread: session.reread_json ? JSON.parse(session.reread_json) : null,
    },
    events: events.map((event) => ({
      seq: event.seq,
      type: event.type,
      createdAt: event.created_at,
      prevHash: event.prev_hash,
      hash: event.hash,
      canonical: event.canonical_json,
    })),
    agreement: score,
  };
}

async function loadEvents(env: Env, id: string): Promise<EventRow[]> {
  const rows = await env.DB.prepare("SELECT seq, type, canonical_json, prev_hash, hash, created_at FROM events WHERE session_id = ? ORDER BY seq").bind(id).all<EventRow>();
  return rows.results;
}

async function documentHashes(dossier: Dossier) {
  const entries = await Promise.all(
    dossier.documents.map(async (doc) => {
      const bytes = utf8(doc.segments.map((segment) => `${segment.id}\t${segment.text}`).join("\n"));
      return [doc.id, await taggedHash("basel-audit-doc-v1", bytes)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function assertBudget(env: Env, request: Request) {
  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("cf-connecting-ip") ?? "lokal";
  await bump(env, `day:${day}`, DAILY_CAP, "Das Tageslimit für Modellanfragen ist erreicht.");
  await bump(env, `ip:${day}:${ip}`, IP_CAP, "Das Tageslimit für Modellanfragen ist erreicht.");
}

async function bump(env: Env, bucket: string, cap: number, message: string) {
  const row = await env.DB.prepare("SELECT calls FROM usage WHERE bucket = ?").bind(bucket).first<{ calls: number }>();
  if ((row?.calls ?? 0) >= cap) throw new Error(message);
  await env.DB.prepare(
    "INSERT INTO usage (bucket, calls) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET calls = calls + 1",
  )
    .bind(bucket)
    .run();
}

function mustDossier(id: string): Dossier {
  const dossier = dossiers.dossiers.find((item) => item.id === id);
  if (!dossier) throw new Error("Unbekanntes Dossier.");
  return dossier;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
