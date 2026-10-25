import rules from "../../tool/rules.json";
import schema from "../../tool/schema.json";
import templates from "../../tool/templates.json";

export type Download = { id: string; filename: string; title: string; body: string };

const fieldLines = schema.fields.map((field) => `- ${field.label}: Abschnitt mit "${field.labelToken}"`).join("\n");

export function downloads(): Download[] {
  return [
    {
      id: "workflow",
      filename: "workflow-vorlage.md",
      title: "Workflow-Vorlage",
      body: `# Workflow-Vorlage\n\n1. Eingang: drei Belege, als Abschnitte mit fester Kennung.\n2. KI-Unterstützung: das Modell nennt nur Abschnittskennungen.\n3. Extraktion: das Werkzeug liest den Text des Abschnitts.\n4. Unsicherheit: widersprüchliche Werte bleiben leer.\n5. Human Review: eine Person gibt frei oder hält zurück.\n6. Audit Trail: die Ereignisse liegen in einer Kette.\n7. Integrität: der Browser rechnet die Kette neu.\n8. Evaluation: die Zähler gelten nur für diese Sitzung.\n\nFelder:\n${fieldLines}\n\nRegelversion: ${rules.version}\n`,
    },
    {
      id: "approval",
      filename: "freigabe-checkliste.md",
      title: "Checkliste Freigabe",
      body: `# Checkliste Freigabe\n\n- Der Entwurf ist als Entwurf bezeichnet.\n- Der Prüfvermerk erscheint erst nach der Entscheidung.\n- Zurückhalten enthält keine Buchungsempfehlung.\n- Der Name ist eine ungeprüfte Angabe.\n- ${templates.claimNote}\n`,
    },
    {
      id: "source",
      filename: "quellen-checkliste.md",
      title: "Checkliste Quellen",
      body: `# Checkliste Quellen\n\n- Jeder Wert stammt aus einem Abschnitt der Datei.\n- Eine Kennung ausserhalb der Datei wird verworfen.\n- Zwei verschiedene Werte zum selben Feld bleiben leer und nennen beide Abschnitte.\n- Netto, MwSt und Brutto müssen auf ${rules.vatToleranceRappen} Rappen stimmen, sonst bleiben sie leer.\n- ${rules.costCentre.missingReason} wird gesetzt, wenn kein Abschnitt "${rules.costCentre.token}" enthält.\n`,
    },
    {
      id: "kpi",
      filename: "kpi-schema.md",
      title: "KPI-Schema",
      body: `# KPI-Schema\n\nAlle Zahlen sind Hypothesen oder Messungen dieser Sitzung. 30% und 90% sind Ziele für einen späteren unterzeichneten Piloten.\n\n- Effizienz: Zeit vom Werkzeugergebnis bis zur Entscheidung. Kein Vergleichswert.\n- Nachvollziehbarkeit: Felder mit geprüftem Abschnitt, von acht.\n- Menschliche Kontrolle: ja nur nach einer Entscheidung.\n- Auditierbarkeit: die gespeicherten Ereignisse und die acht Schritte.\n- Reproduzierbarkeit: die Kennungen von "Erneut lesen" gegen die gespeicherte Lesung.\n- Wissenstransfer: fünf Dateien auf der Seite.\n`,
    },
    {
      id: "lessons",
      filename: "was-offen-bleibt.md",
      title: "Was offen bleibt",
      body: `# Was offen bleibt\n\nDie Seite zeigt die Methode an zwei synthetischen Dossiers.\n\nOffen:\n\n- Kein Auftraggeber ist unterzeichnet.\n- 30% und 90% sind nicht gemessen.\n- Das Schreiben zu Pillar 5 und Ritzi DeFi steht nicht auf dieser Seite.\n\nGezeigt:\n\n- Das Modell wählt einen Abschnitt.\n- Das Werkzeug liest, prüft und formuliert den Entwurf.\n- Eine Person entscheidet, bevor ein Prüfvermerk existiert.\n`,
    },
  ];
}
