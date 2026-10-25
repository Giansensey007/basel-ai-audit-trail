import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import dossiersFile from "../tool/dossiers.json";
import templatesFile from "../tool/templates.json";
import { linkEvents, verifyChain } from "./lib/chain";
import { downloads } from "./lib/docs";
import type { DerivedField, Derivation, Dossier, DossiersFile, TemplatesFile } from "./lib/types";

const dossiers = dossiersFile as DossiersFile;
const templates = templatesFile as TemplatesFile;
const steps = ["Eingang", "Extraktion", "Unsicherheit", "KI-Unterstützung", "Human Review", "Audit Trail", "Integrität", "Evaluation"];

type ApiEvent = { seq: number; type: string; createdAt: string; prevHash: string; hash: string; canonical: string };
type Reread = { match: boolean; fields: { id: string; match: boolean }[] };
type Payload = {
  session: { id: string; dossierId: string; openedAt: string; status: string; error: string | null; reread: Reread | null };
  events: ApiEvent[];
  agreement: { hit: number; total: number };
  error?: string;
};

function dossierById(id: string): Dossier | undefined {
  return dossiers.dossiers.find((item) => item.id === id);
}

function readPayload(event: ApiEvent): Record<string, unknown> {
  return (JSON.parse(event.canonical) as { payload: Record<string, unknown> }).payload;
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">Basel AI Audit Trail</Link>
          <nav className="top-links">
            <Link to="/v/bruch">Gebrochene Kette</Link>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="footer">Pillar 5 GmbH, Basel. Technischer Partner Ritzi DeFi. Synthetische Daten. Kein gefördertes Ergebnis. Keine privaten Schlüssel auf dieser Seite.</footer>
    </>
  );
}

export function Chooser() {
  return (
    <Shell>
      <h1>Basel AI Audit Trail</h1>
      <div className="gold-rule" />
      <p className="lede">Synthetische Lieferantenprüfung, keine echten Belege.</p>
      <div className="chooser-grid">
        {dossiers.dossiers.map((dossier) => (
          <Link key={dossier.id} to={`/fall/${dossier.id}`} className={dossier.call ? "dossier-card is-call" : "dossier-card"}>
            <span className={dossier.call ? "flag" : "flag quiet"}>{dossier.call ? "Für das Gespräch" : "Kontrollfall"}</span>
            <strong>{dossier.title}</strong>
            <p>
              {dossier.call
                ? "Das Modell wählt einen Abschnitt, das Werkzeug liest ihn, eine Person gibt frei, dann gibt es einen Prüflink."
                : dossier.blurb}
            </p>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

export function Loader({ label }: { label: string }) {
  const raw = useId().replace(/:/g, "");
  return (
    <div className="loader-screen" role="status" aria-live="polite">
      <div>
        <svg className="loader-mark" viewBox="0 0 80 64" aria-hidden="true">
          <defs>
            <clipPath id={raw}>
              <text x="2" y="50" fontSize="46" fontFamily="Source Serif 4, Georgia, serif">P5</text>
            </clipPath>
          </defs>
          <g clipPath={`url(#${raw})`}>
            <rect className="loader-fill" x="0" y="0" width="80" height="64" />
          </g>
          <text x="2" y="50" fontSize="46" fill="none" stroke="currentColor" strokeWidth="1.2">P5</text>
        </svg>
        <p className="loader-label">{label}</p>
      </div>
    </div>
  );
}

export function Workspace() {
  const { dossierId = "" } = useParams();
  const dossier = dossierById(dossierId);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [reread, setReread] = useState<Reread | null>(null);
  const [now, setNow] = useState(Date.now());
  const userPick = useRef(false);

  useEffect(() => {
    if (!dossier) return;
    let cancelled = false;
    const keyName = `basel-key-${dossier.id}-${attempt}`;
    let key = sessionStorage.getItem(keyName);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(keyName, key);
    }
    const load = async () => {
      setPhase("loading");
      setError("");
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({ dossierId: dossier.id }),
      });
      const body = (await response.json()) as Payload & { status?: string; id?: string };
      if (cancelled) return;
      if (response.status === 202 || body.status === "reading") {
        const ready = await poll(body.id || "");
        if (cancelled) return;
        if (!ready) {
          setError("Die Lesung dauert zu lange.");
          setPhase("error");
          return;
        }
        setData(ready);
        setReread(ready.session.reread);
        setPhase("ready");
        return;
      }
      if (!response.ok || !body.session) {
        sessionStorage.removeItem(keyName);
        setError(body.error || body.session?.error || "Die Lesung ist fehlgeschlagen.");
        setPhase("error");
        return;
      }
      setData(body);
      setReread(body.session.reread);
      setPhase("ready");
    };
    void load().catch((reason: unknown) => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : "Die Lesung ist fehlgeschlagen.");
      setPhase("error");
    });
    return () => {
      cancelled = true;
    };
  }, [dossier, attempt]);

  const derivationEvent = data?.events.find((event) => event.type === "derivation");
  const decisionEvent = data?.events.find((event) => event.type === "decision");
  const sealEvent = data?.events.find((event) => event.type === "seal");
  const extractionEvent = data?.events.find((event) => event.type === "extraction");
  const derivation = derivationEvent ? (readPayload(derivationEvent) as unknown as Derivation & { rulesHash?: string }) : null;

  useEffect(() => {
    if (!derivation) return;
    const first = derivation.fields.find((field) => field.segmentIds.length)?.segmentIds[0];
    if (first) setSelected(first);
  }, [derivationEvent?.hash]);

  useEffect(() => {
    if (!selected || !userPick.current) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`seg-${selected}`)?.scrollIntoView({ block: "center", behavior: motion ? "auto" : "smooth" });
  }, [selected]);

  useEffect(() => {
    if (!derivationEvent || decisionEvent) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [derivationEvent, decisionEvent]);

  if (!dossier) {
    return <Shell><p>Dieses Dossier gibt es nicht.</p></Shell>;
  }
  if (phase === "loading") {
    return <Shell><Loader label="Abschnitte werden gewählt" /></Shell>;
  }
  if (phase === "error" || !data || !derivation) {
    return (
      <Shell>
        <h1>{dossier.title}</h1>
        <p className="bad" role="alert">{error || "Die Lesung ist fehlgeschlagen."}</p>
        <button className="btn" type="button" onClick={() => setAttempt((value) => value + 1)}>Erneut versuchen</button>
      </Shell>
    );
  }

  const done = new Set<string>(["Eingang", "Extraktion", "Unsicherheit", "KI-Unterstützung", "Audit Trail", "Evaluation"]);
  if (decisionEvent) done.add("Human Review");
  if (sealEvent) done.add("Integrität");
  const active = steps.find((step) => !done.has(step)) ?? "Evaluation";
  const covered = derivation.fields.filter((field) => field.status === "filled" || (field.status === "conflict" && field.segmentIds.length >= 2)).length;
  const started = Date.parse(derivationEvent!.createdAt);
  const ended = decisionEvent ? Date.parse(decisionEvent.createdAt) : now;
  const seconds = Math.max(0, Math.round((ended - started) / 1000));
  const model = extractionEvent ? String(readPayload(extractionEvent).model ?? "") : "";
  const rulesVersion = "2026-10-25";
  const sealText = sealEvent ? String(readPayload(sealEvent).pruefvermerk ?? "") : "";
  const verifyHref = sealEvent ? `/v/${data.session.id}#${sealEvent.hash}` : "";

  async function send(decision: "approve" | "reject") {
    if (!data) return;
    setSaving(true);
    const response = await fetch(`/api/sessions/${data.session.id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, comment, decision }),
    });
    const body = (await response.json()) as Payload;
    if (body.session) setData(body);
    else setError(body.error || "Die Entscheidung wurde nicht gespeichert.");
    setSaving(false);
  }

  async function again() {
    if (!data) return;
    setSaving(true);
    const response = await fetch(`/api/sessions/${data.session.id}/reread`, { method: "POST" });
    const body = (await response.json()) as Reread & { error?: string };
    if (response.ok && typeof body.match === "boolean") setReread(body);
    else setError(body.error || "Die erneute Lesung ist fehlgeschlagen.");
    setSaving(false);
  }

  function saveFile(filename: string, body: string) {
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Shell>
      <p className="pitch">Problem: Nach einer KI-Hilfe fehlen oft die Quelle, der Widerspruch und die Person, die freigibt.</p>
      <p className="pitch">Verantwortlich: Gian Seyitcan Senpinar, Pillar 5 GmbH, Basel. Kein Auftraggeber ist unterzeichnet.</p>
      <p className="pitch">Lösung: Das Modell wählt einen Abschnitt. Das Werkzeug liest ihn. Eine Person gibt frei.</p>
      <p className="pitch">Messung: Übereinstimmung mit der hinterlegten Referenzlesung. 30% und 90% bleiben Ziele für einen späteren unterzeichneten Piloten.</p>
      <p className="method">Methode: rules.json. Das Modell kann ausgetauscht werden.</p>
      <h1>{dossier.title}</h1>
      <div className="gold-rule" />
      <ol className="rail" aria-label="Schritte">
        {steps.map((step) => (
          <li key={step} className={done.has(step) ? "is-done" : step === active ? "is-now" : ""}>{step}</li>
        ))}
      </ol>
      <div className="workspace">
        <section>
          <p className="read-note">Das Werkzeug hat diesen Text hier gelesen. Gewählter Abschnitt: {selected || "noch keiner"}.</p>
          {dossier.documents.map((doc) => (
            <article key={doc.id} className="doc">
              <h2>{doc.title}</h2>
              {doc.segments.map((segment) => (
                <div key={segment.id} id={`seg-${segment.id}`} className={segment.id === selected ? "segment is-on" : "segment"}>
                  <span className="sid">{segment.id}</span>
                  {segment.text}
                </div>
              ))}
            </article>
          ))}
        </section>
        <section className="side">
          {derivation.fields.map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              dossier={dossier}
              selected={selected}
              onPick={(id) => {
                userPick.current = true;
                setSelected(id);
              }}
              vatCleared={derivation.vatCleared}
            />
          ))}
          <div className="draft">
            <h2>Entwurf des Werkzeugs</h2>
            <p>{derivation.draftText}</p>
          </div>
          {sealText ? (
            <div className="vermerk">
              <h2>Prüfvermerk</h2>
              <p>{sealText}</p>
              <p><a href={verifyHref}>Prüflink öffnen</a></p>
            </div>
          ) : (
            <form className="decision" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="reviewer-name">Name</label>
              <input id="reviewer-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              <label htmlFor="reviewer-comment">Kommentar</label>
              <textarea id="reviewer-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
              <p className="claim">{templates.claimNote}</p>
              <div className="actions">
                <button className="btn" type="button" disabled={saving || name.trim().length < 1} onClick={() => void send("approve")}>Freigeben</button>
                <button className="btn ghost" type="button" disabled={saving || name.trim().length < 1} onClick={() => void send("reject")}>Zurückhalten</button>
              </div>
            </form>
          )}
        </section>
      </div>
      {error ? <p className="bad" role="alert">{error}</p> : null}
      <section className="kpi" aria-label="KPI-Hypothesen, vor dem Pilot">
        <h2>KPI-Hypothesen, vor dem Pilot</h2>
        <div className="kpi-grid">
          <div className="kpi-row">Effizienz: {seconds} Sekunden. Kein Vergleichswert.</div>
          <div className="kpi-row">Nachvollziehbarkeit: {covered} von 8 Feldern mit geprüftem Abschnitt.</div>
          <div className="kpi-row">Menschliche Kontrolle: {decisionEvent ? "ja" : "nein"}</div>
          <div className="kpi-row">Auditierbarkeit: {data.events.length} von 5 Ereignissen, acht Schritte in der Leiste.</div>
          <div className="kpi-row">Reproduzierbarkeit: {reread ? (reread.match ? "dieselbe Kennungsmenge" : "Abweichung zur gespeicherten Lesung") : "noch nicht erneut gelesen"}</div>
          <div className="kpi-row">Wissenstransfer: 5 Dateien. Die Ziele 30% und 90% sind noch offen.</div>
          <div className="kpi-row">Übereinstimmung mit der Referenzlesung: {data.agreement.hit} von {data.agreement.total}</div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn ghost" type="button" disabled={saving} onClick={() => void again()}>Erneut lesen</button>
        </div>
      </section>
      <ol className="tape">
        {data.events.map((event) => (
          <li key={event.seq}>{event.type} | {event.createdAt} | {event.hash.slice(0, 12)}{event.type === "extraction" ? ` | ${model}, rules.json ${rulesVersion}` : ""}</li>
        ))}
      </ol>
      <section className="downloads">
        <h2>Unterlagen</h2>
        {downloads().map((file) => (
          <a key={file.id} href={`#${file.id}`} onClick={(event) => { event.preventDefault(); saveFile(file.filename, file.body); }}>{file.title}</a>
        ))}
      </section>
    </Shell>
  );
}

function FieldRow({
  field,
  dossier,
  selected,
  onPick,
  vatCleared,
}: {
  field: DerivedField;
  dossier: Dossier;
  selected: string;
  onPick: (id: string) => void;
  vatCleared: boolean;
}) {
  const texts = field.segmentIds.map((id) => findSegment(dossier, id)).filter(Boolean);
  const warn = field.status === "conflict"
    ? texts.join(" | ")
    : field.status !== "filled"
      ? vatCleared && (field.id === "net" || field.id === "vatRate" || field.id === "gross")
        ? "Netto, MwSt und Brutto bleiben leer."
        : "Beleg nicht im Dokument"
      : "";
  const primary = field.segmentIds[0] ?? "";
  return (
    <button type="button" className={field.segmentIds.includes(selected) ? "field is-on" : "field"} onClick={() => primary && onPick(primary)}>
      <span className="label">{field.label}</span>
      <span className="value">{field.value ?? ""}</span>
      <span className="meta">Gewählter Abschnitt: {field.segmentIds.join(", ") || "keiner"}</span>
      {warn ? <span className="warn">{warn}</span> : null}
    </button>
  );
}

function findSegment(dossier: Dossier, id: string): string {
  for (const doc of dossier.documents) {
    const segment = doc.segments.find((item) => item.id === id);
    if (segment) return segment.text;
  }
  return "";
}

async function poll(id: string): Promise<Payload | null> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch(`/api/sessions/${id}`);
    const body = (await response.json()) as Payload;
    if (body.session?.status === "ready") return body;
    if (body.session?.status === "error") throw new Error(body.session.error || "Die Lesung ist fehlgeschlagen.");
  }
  return null;
}

export function Verify() {
  const { sessionId = "" } = useParams();
  const [state, setState] = useState<"wait" | "green" | "red">("wait");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const body = (await response.json()) as Payload;
      if (!body.events) {
        if (!cancelled) {
          setState("red");
          setDetail("Die Sitzung fehlt.");
        }
        return;
      }
      const checked = await verifyChain(body.events.map((event) => ({
        seq: event.seq,
        type: event.type,
        createdAt: event.createdAt,
        prevHash: event.prevHash,
        hash: event.hash,
        canonical: event.canonical,
      })));
      const seal = [...body.events].reverse().find((event) => event.type === "seal");
      const fragment = window.location.hash.replace("#", "");
      const fragmentOk = !fragment || fragment === seal?.hash;
      if (cancelled) return;
      setState(checked.ok && fragmentOk ? "green" : "red");
      setDetail(checked.ok && fragmentOk ? "Der Link passt zur Kette." : "Der Link passt nicht mehr zur Kette.");
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <Shell>
      <h1>Integrität</h1>
      <div className="gold-rule" />
      {state === "wait" ? <Loader label="Kette wird geprüft" /> : <p className={state === "green" ? "ok" : "bad"}>{detail}</p>}
      <p className="claim">Das zeigt, dass der kopierte Link noch zum Protokoll passt. Es ist kein externer Zeitstempel.</p>
    </Shell>
  );
}

export function BrokenChain() {
  const [state, setState] = useState<"wait" | "red" | "green">("wait");
  useEffect(() => {
    void linkEvents("bruch", new Date("2026-10-25T12:00:00.000Z"), [
      { type: "intake", payload: { dossierId: "klar" } },
      { type: "seal", payload: { note: "beispiel" } },
    ]).then(async (events) => {
      const broken = events.map((event) => ({ ...event }));
      broken[0] = { ...broken[0], hash: "f".repeat(64) };
      const checked = await verifyChain(broken);
      setState(checked.ok ? "green" : "red");
    });
  }, []);
  return (
    <Shell>
      <h1>Gebrochene Kette</h1>
      <div className="gold-rule" />
      {state === "wait" ? <p>Prüfung läuft.</p> : <p className={state === "red" ? "bad" : "ok"}>{state === "red" ? "Die Beispielkette ist gebrochen." : "Unerwartet intakt."}</p>}
    </Shell>
  );
}
