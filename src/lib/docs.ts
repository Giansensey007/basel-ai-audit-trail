import rules from "../../tool/rules.json";
import schema from "../../tool/schema.json";
import type { Copy, Lang } from "./i18n";

export type Download = { id: string; filename: string; title: string; body: string };

export function downloads(lang: Lang, t: Copy): Download[] {
  const fields = schema.fields.map((field) => `- ${t.fields[field.id as keyof Copy["fields"]]}: ${field.labelToken}`).join("\n");
  if (lang === "en") {
    return [
      { id: "workflow", filename: "workflow.md", title: t.downloads.workflow, body: `# Workflow\n\n1. Three documents, fixed line IDs.\n2. The model names IDs only.\n3. The tool reads the line.\n4. A clash stays blank.\n5. A person approves or holds.\n6. Events form a chain.\n7. The browser recomputes the chain.\n8. Counters are this session only.\n\nFields:\n${fields}\n\nRules: ${rules.version}\n` },
      { id: "approval", filename: "sign-off.md", title: t.downloads.approval, body: `# Sign-off\n\n- The proposal is not the record.\n- The record appears after the decision.\n- Hold has no booking line.\n- The name is unchecked.\n` },
      { id: "source", filename: "sources.md", title: t.downloads.source, body: `# Sources\n\n- Each value comes from a line.\n- An unknown ID is dropped.\n- Two values for one field stay blank.\n- Net, VAT, and gross must match within ${rules.vatToleranceRappen} cent, or they stay blank.\n- ${t.costMissing} if no line contains "${rules.costCentre.token}".\n` },
      { id: "kpi", filename: "kpi.md", title: t.downloads.kpi, body: `# KPI\n\n30% and 90% are targets for a later signed pilot.\n\n- Time: this sitting only.\n- Cited fields: of eight.\n- Sign-off: only after a decision.\n- Chain: stored events.\n- Reread: same IDs or not.\n- Files: five downloads.\n` },
      { id: "lessons", filename: "open.md", title: t.downloads.lessons, body: `# Open\n\n- No client is signed.\n- 30% and 90% are not measured.\n- The partner letter is not on this page.\n` },
    ];
  }
  return [
    { id: "workflow", filename: "workflow.md", title: t.downloads.workflow, body: `# Workflow\n\n1. Drei Belege, feste Zeilen-IDs.\n2. Das Modell nennt nur IDs.\n3. Das Werkzeug liest die Zeile.\n4. Widerspruch bleibt leer.\n5. Eine Person gibt frei oder hält zurück.\n6. Ereignisse bilden eine Kette.\n7. Der Browser rechnet die Kette neu.\n8. Zähler gelten nur für diese Sitzung.\n\nFelder:\n${fields}\n\nRegeln: ${rules.version}\n` },
    { id: "approval", filename: "freigabe.md", title: t.downloads.approval, body: `# Freigabe\n\n- Der Vorschlag ist nicht der Prüfvermerk.\n- Der Prüfvermerk kommt nach der Entscheidung.\n- Zurückhalten hat keine Buchungszeile.\n- Der Name ist ungeprüft.\n` },
    { id: "source", filename: "quellen.md", title: t.downloads.source, body: `# Quellen\n\n- Jeder Wert kommt aus einer Zeile.\n- Eine unbekannte ID fällt weg.\n- Zwei Werte zum selben Feld bleiben leer.\n- Netto, MwSt und Brutto müssen auf ${rules.vatToleranceRappen} Rappen stimmen, sonst bleiben sie leer.\n- ${t.costMissing}, wenn keine Zeile "${rules.costCentre.token}" enthält.\n` },
    { id: "kpi", filename: "kpi.md", title: t.downloads.kpi, body: `# KPI\n\n30% und 90% sind Ziele für einen späteren Piloten.\n\n- Zeit: nur diese Sitzung.\n- Belegte Felder: von acht.\n- Freigabe: nur nach einer Entscheidung.\n- Kette: gespeicherte Ereignisse.\n- Erneute Lesung: gleiche IDs oder nicht.\n- Dateien: fünf Downloads.\n` },
    { id: "lessons", filename: "offen.md", title: t.downloads.lessons, body: `# Offen\n\n- Kein Auftraggeber ist unterzeichnet.\n- 30% und 90% sind nicht gemessen.\n- Das Partnerschreiben steht nicht auf dieser Seite.\n` },
  ];
}
