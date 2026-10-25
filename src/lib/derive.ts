import type {
  DerivedField,
  Derivation,
  Dossier,
  RulesFile,
  SchemaFile,
  Segment,
  TemplatesFile,
} from "./types";

type Located = Segment & { documentId: string };

function locate(dossier: Dossier): Map<string, Located> {
  const map = new Map<string, Located>();
  for (const doc of dossier.documents) {
    for (const segment of doc.segments) map.set(segment.id, { ...segment, documentId: doc.id });
  }
  return map;
}

function moneyToRappen(raw: string): number | null {
  const cleaned = raw.replace(/'/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const cents = (frac + "00").slice(0, 2);
  return Number(whole) * 100 + Number(cents);
}

function formatMoney(rappen: number): string {
  const whole = Math.floor(rappen / 100);
  const cents = String(rappen % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${grouped}.${cents}`;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function parseValue(type: string, pattern: string, body: string): { key: string; display: string } | null {
  const match = body.match(new RegExp(pattern));
  if (!match) return null;
  const captured = (match[1] ?? "").trim();
  if (type === "money") {
    const rappen = moneyToRappen(captured);
    if (rappen === null) return null;
    return { key: String(rappen), display: formatMoney(rappen) };
  }
  if (type === "percent") {
    if (!/^\d+(\.\d+)?$/.test(captured)) return null;
    return { key: String(Number(captured)), display: `${captured}%` };
  }
  if (!captured) return null;
  return { key: captured, display: captured };
}

export function costCentreMissing(dossier: Dossier, rules: RulesFile): boolean {
  const token = rules.costCentre.token;
  return !dossier.documents.some((doc) => doc.segments.some((segment) => segment.text.includes(token)));
}

export function derive(args: {
  dossier: Dossier;
  schema: SchemaFile;
  rules: RulesFile;
  templates: TemplatesFile;
  picked: Record<string, string[]>;
}): Derivation {
  const index = locate(args.dossier);
  const fields: DerivedField[] = [];
  const accepted: Record<string, string[]> = {};
  const reasons: string[] = [];

  for (const spec of args.schema.fields) {
    const raw = args.picked[spec.id] ?? [];
    const seen = new Set<string>();
    const matches: { id: string; key: string; display: string }[] = [];
    for (const id of raw) {
      if (seen.has(id)) continue;
      seen.add(id);
      const segment = index.get(id);
      if (!segment) continue;
      if (!spec.documents.includes(segment.documentId)) continue;
      if (!segment.text.startsWith(spec.labelToken)) continue;
      const body = segment.text.slice(spec.labelToken.length).trim();
      const parsed = parseValue(spec.type, args.rules.types[spec.type], body);
      if (!parsed) continue;
      matches.push({ id, key: parsed.key, display: parsed.display });
    }
    const keys = [...new Set(matches.map((item) => item.key))];
    let status: DerivedField["status"] = "missing";
    let value: string | null = null;
    if (keys.length === 1) {
      status = "filled";
      value = matches.find((item) => item.key === keys[0])?.display ?? null;
    } else if (keys.length > 1) {
      status = "conflict";
    }
    const segmentIds = matches.map((item) => item.id);
    accepted[spec.id] = segmentIds;
    if (status === "conflict") {
      reasons.push(fill(args.templates.reasonConflict, { label: spec.label, ids: segmentIds.join(", ") }));
    } else if (status === "missing") {
      reasons.push(fill(args.templates.reasonMissing, { label: spec.label }));
    }
    fields.push({ id: spec.id, label: spec.label, status, value, segmentIds });
  }

  let vatCleared = false;
  const net = fields.find((field) => field.id === "net");
  const rate = fields.find((field) => field.id === "vatRate");
  const gross = fields.find((field) => field.id === "gross");
  if (net?.status === "filled" && rate?.status === "filled" && gross?.status === "filled") {
    const netRappen = moneyToRappen(net.value ?? "");
    const grossRappen = moneyToRappen(gross.value ?? "");
    const rateNumber = Number((rate.value ?? "").replace("%", ""));
    if (netRappen === null || grossRappen === null || !Number.isFinite(rateNumber)) {
      vatCleared = true;
    } else {
      const expected = Math.round((netRappen * (10000 + Math.round(rateNumber * 100))) / 10000);
      if (Math.abs(expected - grossRappen) > args.rules.vatToleranceRappen) vatCleared = true;
    }
  }
  if (vatCleared && args.rules.holdIfVatMismatch) {
    for (const field of fields) {
      if (field.id === "net" || field.id === "vatRate" || field.id === "gross") {
        field.status = "missing";
        field.value = null;
      }
    }
    reasons.push(args.templates.reasonVat);
  }

  const centreMissing = costCentreMissing(args.dossier, args.rules);
  if (centreMissing && args.rules.holdIfCostCentreMissing) reasons.push(args.rules.costCentre.missingReason);

  const anyEmpty = fields.some((field) => field.status !== "filled");
  const hold =
    (args.rules.holdIfAnyFieldEmpty && anyEmpty) ||
    (args.rules.holdIfVatMismatch && vatCleared) ||
    (args.rules.holdIfCostCentreMissing && centreMissing);
  const recommendation = hold ? "hold" : "book";
  const lines = [args.templates.draftIntro, recommendation === "book" ? args.templates.bookLine : args.templates.holdLine];
  if (reasons.length) lines.push(...reasons);
  return {
    fields,
    recommendation,
    reasons,
    draftText: lines.join(" "),
    accepted,
    vatCleared,
    costCentreMissing: centreMissing,
  };
}

export function sameIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((id, index) => id === b[index]);
}

export function agreementCount(
  accepted: Record<string, string[]>,
  gold: Record<string, string[]>,
  fieldIds: string[],
): { hit: number; total: number } {
  let hit = 0;
  for (const id of fieldIds) {
    if (sameIdSet(accepted[id] ?? [], gold[id] ?? [])) hit += 1;
  }
  return { hit, total: fieldIds.length };
}

export function pruefvermerk(args: {
  templates: TemplatesFile;
  recommendation: "book" | "hold";
  decision: "approve" | "reject";
  name: string;
  time: string;
}): string {
  if (args.decision === "reject") {
    return fill(args.templates.finalReject, { name: args.name, time: args.time });
  }
  if (args.recommendation === "book") {
    return fill(args.templates.finalBook, { name: args.name, time: args.time });
  }
  return fill(args.templates.finalHoldApproved, { name: args.name, time: args.time });
}
