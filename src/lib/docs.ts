import type { Copy, Lang } from "./i18n";

export type Download = { id: string; filename: string; title: string; body: string };

export function downloads(lang: Lang, t: Copy): Download[] {
  if (lang === "en") {
    return [
      { id: "workflow", filename: "workflow.md", title: t.downloads.workflow, body: `# Workflow\n\n1. Three documents with line IDs.\n2. AI names IDs only.\n3. Conflicts stay blank.\n4. A person decides.\n` },
      { id: "approval", filename: "sign-off.md", title: t.downloads.approval, body: `# Sign-off\n\n- Proposal before, record after.\n- Hold means no booking.\n- The name is unchecked.\n` },
      { id: "source", filename: "sources.md", title: t.downloads.source, body: `# Sources\n\n- Every value comes from a line.\n- Unknown IDs are dropped.\n- Two values for one field stay blank.\n- Net + VAT = gross (within 1 cent), else blank.\n` },
      { id: "kpi", filename: "kpi.md", title: t.downloads.kpi, body: `# KPI\n\n- Time: this sitting only.\n- Cited fields: of eight.\n- Decision: after a person.\n` },
      { id: "lessons", filename: "open.md", title: t.downloads.lessons, body: `# Open\n\n- No client yet.\n- Targets (30% time, 90% cited) unmeasured.\n` },
    ];
  }
  return [
    { id: "workflow", filename: "workflow.md", title: t.downloads.workflow, body: `# Workflow\n\n1. Drei Belege mit Zeilen-IDs.\n2. Die KI nennt nur IDs.\n3. Widerspruch bleibt leer.\n4. Ein Mensch entscheidet.\n` },
    { id: "approval", filename: "freigabe.md", title: t.downloads.approval, body: `# Freigabe\n\n- Vorschlag zuerst, Prüfvermerk danach.\n- Zurückhalten heisst keine Buchung.\n- Der Name ist ungeprüft.\n` },
    { id: "source", filename: "quellen.md", title: t.downloads.source, body: `# Quellen\n\n- Jeder Wert kommt aus einer Zeile.\n- Unbekannte IDs fallen weg.\n- Zwei Werte zum selben Feld bleiben leer.\n- Netto + MwSt = Brutto (auf 1 Rappen), sonst leer.\n` },
    { id: "kpi", filename: "kpi.md", title: t.downloads.kpi, body: `# KPI\n\n- Zeit: nur diese Sitzung.\n- Belegte Felder: von acht.\n- Entscheid: nach einer Person.\n` },
    { id: "lessons", filename: "offen.md", title: t.downloads.lessons, body: `# Offen\n\n- Kein Auftraggeber.\n- Ziele 30% Zeit, 90% Beleg: ungemessen.\n` },
  ];
}
