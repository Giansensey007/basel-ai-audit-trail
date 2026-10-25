# Basel AI Audit Trail

Methodendemonstration für den BaselTech-Termin. Zwei synthetische Rechnungsdossiers. Das Modell nennt nur Abschnittskennungen. `rules.json` leitet den Entwurf ab. Ein Prüfvermerk entsteht erst nach einer Freigabe. Der Browser rechnet die SHA-256-Kette nach RFC 8785 neu.

Es ist kein gefördertes Ergebnis und kein unterzeichneter Auftraggeber. 30% und 90% bleiben Ziele.

## Lokal

```bash
npm install
npm test
npm run build
npx wrangler d1 migrations apply basel-audit-trail --local
npm start
```

Die Modellzugangsdaten stehen nur in `.dev.vars` auf dem Rechner und als Servergeheimnis. Sie gehören nicht ins Repository und nicht in die Seite.

## Was der Hash zeigt

Jedes Ereignis wird kanonisch serialisiert und mit einem Namen (`basel-audit-event-v1`) gehasht. Der Prüflink enthält den Siegel-Hash. Wenn das Protokoll danach geändert wird, wird der alte Link rot. Das ist kein externer Zeitstempel.

## English

Pillar 5 GmbH, Basel. A public method demo: the model points at a printed segment, the rule file derives the record, and a person approves before a final note exists. No client is signed. No credentials are stored in this repository.
