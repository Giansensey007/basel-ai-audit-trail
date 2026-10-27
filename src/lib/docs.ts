import type { Copy, Lang } from "./i18n";

export type Download = { id: string; filename: string; title: string; body: string };

export function downloads(lang: Lang, t: Copy): Download[] {
  if (lang === "en") {
    return [
      { id: "workflow", filename: "workflow.md", title: t.downloads.workflow, body: `# Workflow\n\n1. Three documents with line IDs.\n2. AI names IDs only.\n3. Conflicts stay blank.\n4. A person decides.\n5. The proof link checks the chain.\n` },
      { id: "approval", filename: "sign-off.md", title: t.downloads.approval, body: `# Sign-off\n\n- Proposal before, record after.\n- Hold means no booking.\n- The name is unchecked.\n` },
      { id: "source", filename: "sources.md", title: t.downloads.source, body: `# Sources\n\n- Every value comes from a line.\n- Unknown IDs are dropped.\n- Two values for one field stay blank.\n- Net + VAT = gross (within 1 cent), else blank.\n` },
      { id: "kpi", filename: "kpi.md", title: t.downloads.kpi, body: `# KPI\n\nThis session\n\n- Time: seconds from the tool's proposal to the person's decision. One sitting, no comparison.\n- Cited fields: of 8 fields, how many carry a source line. A conflict counts when both sides are cited.\n- Decision: a named person decided. Without one there is no record.\n\nPilot targets (not measured)\n\n- 30% less handling time than the baseline, measured in the pilot partner's current process before the tool.\n- 90% of output fields with a source line.\n- 100% of final outputs with a named decision.\n` },
      { id: "lessons", filename: "open.md", title: t.downloads.lessons, body: `# Open\n\n- No signed pilot partner yet.\n- Targets (30% time, 90% cited) unmeasured.\n` },
    ];
  }
  return [
    { id: "workflow", filename: "workflow.md", title: t.downloads.workflow, body: `# Workflow\n\n1. Drei Belege mit Zeilen-IDs.\n2. Die KI nennt nur IDs.\n3. Widerspruch bleibt leer.\n4. Ein Mensch entscheidet.\n5. Der Prüflink prüft die Kette.\n` },
    { id: "approval", filename: "freigabe.md", title: t.downloads.approval, body: `# Freigabe\n\n- Vorschlag zuerst, Prüfvermerk danach.\n- Zurückhalten heisst keine Buchung.\n- Der Name ist ungeprüft.\n` },
    { id: "source", filename: "quellen.md", title: t.downloads.source, body: `# Quellen\n\n- Jeder Wert kommt aus einer Zeile.\n- Unbekannte IDs fallen weg.\n- Zwei Werte zum selben Feld bleiben leer.\n- Netto + MwSt = Brutto (auf 1 Rappen), sonst leer.\n` },
    { id: "kpi", filename: "kpi.md", title: t.downloads.kpi, body: `# KPI\n\nDiese Sitzung\n\n- Zeit: Sekunden vom Vorschlag des Werkzeugs bis zum Entscheid der Person. Eine Sitzung, kein Vergleich.\n- Belegte Felder: von 8 Feldern, wie viele eine Quellzeile tragen. Ein Widerspruch zählt, wenn beide Seiten belegt sind.\n- Entscheid: Eine genannte Person hat entschieden. Ohne sie kein Prüfvermerk.\n\nPilotziele (nicht gemessen)\n\n- 30% weniger Bearbeitungszeit als die Ausgangsmessung im heutigen Ablauf des Pilotpartners, vor dem Werkzeug.\n- 90% der Ausgabefelder mit Quellzeile.\n- 100% der Endergebnisse mit genanntem Entscheid.\n` },
    { id: "lessons", filename: "offen.md", title: t.downloads.lessons, body: `# Offen\n\n- Noch kein unterzeichneter Pilotpartner.\n- Ziele 30% Zeit, 90% Beleg: ungemessen.\n` },
  ];
}
