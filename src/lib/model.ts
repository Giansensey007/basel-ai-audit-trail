import type { Dossier, SchemaFile } from "./types";
import { buildPrompt, segmentCatalog } from "./prompt";

const DAILY_CAP = 80;
const IP_CAP = 40;

export { DAILY_CAP, IP_CAP };

export async function chooseSegments(args: {
  apiKey: string;
  model: string;
  dossier: Dossier;
  schema: SchemaFile;
}): Promise<{ segmentIds: Record<string, string[]>; raw: string; prompt: string }> {
  const prompt = buildPrompt(args.dossier, args.schema);
  const ids = segmentCatalog(args.dossier).map((item) => item.id);
  const fieldIds = args.schema.fields.map((field) => field.id);
  const properties = Object.fromEntries(
    fieldIds.map((id) => [id, { type: "array", items: { type: "string", enum: ids } }]),
  );
  const body = {
    model: args.model,
    temperature: 0,
    seed: 510,
    max_tokens: 900,
    reasoning: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "segments",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["fields"],
          properties: {
            fields: {
              type: "object",
              additionalProperties: false,
              required: fieldIds,
              properties,
            },
          },
        },
      },
    },
  };
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Das Modell hat mit Status ${response.status} geantwortet.`);
  }
  const parsed = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
  const content = parsed.choices?.[0]?.message?.content ?? "";
  const data = JSON.parse(content) as { fields?: Record<string, unknown> };
  const segmentIds: Record<string, string[]> = {};
  for (const id of fieldIds) {
    const value = data.fields?.[id];
    segmentIds[id] = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  }
  return { segmentIds, raw, prompt };
}

export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Die Lesung ist fehlgeschlagen.";
  return message.replace(/sk-or-[A-Za-z0-9_-]+/g, "[entfernt]").slice(0, 280);
}
