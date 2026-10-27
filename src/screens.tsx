import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import dossiersFile from "../tool/dossiers.json";
import schemaFile from "../tool/schema.json";
import { linkEvents, verifyChain } from "./lib/chain";
import { zurich } from "./lib/clock";
import { downloads } from "./lib/docs";
import type { Copy } from "./lib/i18n";
import { useI18n } from "./lib/lang";
import type { DerivedField, Derivation, Dossier, DossiersFile, SchemaFile } from "./lib/types";

const dossiers = dossiersFile as DossiersFile;
const schema = schemaFile as SchemaFile;
const railIds = ["intake", "extract", "conflict", "ai", "review", "audit", "integrity", "evaluation"] as const;
const tourKeys = ["docs", "fields", "decision", "audit"] as const;

type ApiEvent = { seq: number; type: string; createdAt: string; prevHash: string; hash: string; canonical: string };
type Reread = { match: boolean; fields: { id: string; match: boolean }[] };
type Payload = {
  session: { id: string; dossierId: string; openedAt: string; status: string; error: string | null; reread: Reread | null };
  events: ApiEvent[];
  agreement: { hit: number; total: number };
  error?: string;
};

function sittingTime(started: string | undefined, ended: string | undefined, now: number, t: Copy): string {
  if (!started) return t.noTime;
  const open = Math.max(0, Math.round((now - Date.parse(started)) / 1000));
  if (!ended) return open > 30 * 60 ? t.earlier : t.running(open);
  const span = Math.max(0, Math.round((Date.parse(ended) - Date.parse(started)) / 1000));
  if (span > 30 * 60) return t.earlier;
  return t.untilDecision(span);
}

function freshReading(dossierId: string, again: () => void) {
  for (let index = 0; index < 30; index += 1) sessionStorage.removeItem(`basel-key-${dossierId}-${index}`);
  again();
}

function dossierById(id: string): Dossier | undefined {
  return dossiers.dossiers.find((item) => item.id === id);
}

function caseTitle(id: string, t: Copy): string {
  if (id === "abweichung") return t.caseMismatch;
  if (id === "klar") return t.caseClean;
  return id;
}

function fieldLabel(id: string, t: Copy): string {
  return t.fields[id as keyof Copy["fields"]] ?? id;
}

function docTitle(id: string, fallback: string, t: Copy): string {
  return t.docs[id as keyof Copy["docs"]] ?? fallback;
}

function readPayload(event: ApiEvent): Record<string, unknown> {
  return (JSON.parse(event.canonical) as { payload: Record<string, unknown> }).payload;
}

function findSegment(dossier: Dossier, id: string): { text: string; docId: string; docTitle: string } | null {
  for (const doc of dossier.documents) {
    const segment = doc.segments.find((item) => item.id === id);
    if (segment) return { text: segment.text, docId: doc.id, docTitle: doc.title };
  }
  return null;
}

function valueGroups(field: DerivedField, dossier: Dossier): { value: string; ids: string[]; docs: string[] }[] {
  const spec = schema.fields.find((item) => item.id === field.id);
  const map = new Map<string, { ids: string[]; docs: string[] }>();
  for (const id of field.segmentIds) {
    const segment = findSegment(dossier, id);
    if (!segment) continue;
    const value = spec && segment.text.startsWith(spec.labelToken) ? segment.text.slice(spec.labelToken.length).trim() : segment.text;
    const group = map.get(value) ?? { ids: [], docs: [] };
    group.ids.push(id);
    if (!group.docs.includes(segment.docId)) group.docs.push(segment.docId);
    map.set(value, group);
  }
  return [...map.entries()].map(([value, group]) => ({ value, ids: group.ids, docs: group.docs }));
}

function clashDocs(field: DerivedField, dossier: Dossier, t: Copy): string {
  return valueGroups(field, dossier)
    .map((group) => `${group.docs.map((id) => docTitle(id, id, t)).join("/")}: ${group.value}`)
    .join(` ${t.vs} `);
}

function clashIds(field: DerivedField, dossier: Dossier, t: Copy): string {
  return valueGroups(field, dossier)
    .map((group) => `${group.value} (${group.ids.join(", ")})`)
    .join(` ${t.vs} `);
}

function proposalLines(derivation: Derivation, dossier: Dossier, t: Copy): string[] {
  const lines: string[] = [];
  const amount = new Set(["net", "vatRate", "gross"]);
  for (const field of derivation.fields) {
    if (field.status === "conflict") lines.push(`${fieldLabel(field.id, t)}: ${clashIds(field, dossier, t)}`);
  }
  if (derivation.vatCleared) lines.push(t.emptyAmounts);
  for (const field of derivation.fields) {
    if (field.status !== "missing") continue;
    if (derivation.vatCleared && amount.has(field.id)) continue;
    lines.push(`${fieldLabel(field.id, t)}: ${t.missing}`);
  }
  if (derivation.costCentreMissing) lines.push(t.costMissing);
  return lines;
}

export function Shell({ children }: { children: ReactNode }) {
  const { lang, setLang, t } = useI18n();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">{t.brand}</Link>
          <nav className="top-links">
            <Link to="/">{t.dossiers}</Link>
            <div className="lang" role="group" aria-label="DE EN">
              <button type="button" className={lang === "de" ? "is-on" : ""} onClick={() => setLang("de")}>DE</button>
              <span aria-hidden="true">|</span>
              <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="footer">
        {t.footer} <Link to="/v/bruch">{t.brokenLink}</Link>
      </footer>
    </>
  );
}

export function Chooser() {
  const { t } = useI18n();
  const ordered = [...dossiers.dossiers].sort((a, b) => Number(b.call) - Number(a.call));
  const first = ordered[0];
  return (
    <Shell>
      <h1>{t.headline}</h1>
      <div className="gold-rule" />
      <p className="lede">{t.lede}</p>
      <div className="how">
        <strong>{t.howTitle}</strong>
        <ol className="steps">
          {t.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="actions">
          <Link className="btn" to={`/fall/${first.id}?tour=1`}>{t.tourCta}</Link>
        </div>
      </div>
      <div className="chooser-grid">
        {ordered.map((dossier) => (
          <Link
            key={dossier.id}
            to={`/fall/${dossier.id}`}
            className={dossier.call ? "dossier-card is-call" : "dossier-card"}
          >
            <span className={dossier.call ? "flag" : "flag quiet"}>{dossier.call ? t.forCall : t.control}</span>
            <strong>{caseTitle(dossier.id, t)}</strong>
            <span className="card-note">{dossier.call ? t.caseMismatchNote : t.caseCleanNote}</span>
          </Link>
        ))}
      </div>
      <p className="claim">{t.synthetic}</p>
    </Shell>
  );
}

export function Loader({ label, hint }: { label: string; hint?: (n: number) => string }) {
  const raw = useId().replace(/:/g, "");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!hint) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [hint]);
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
        {hint ? <p className="loader-hint">{hint(seconds)}</p> : null}
      </div>
    </div>
  );
}

export function Workspace() {
  const { dossierId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { lang, t } = useI18n();
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
  const [tourStep, setTourStep] = useState(0);
  const [tourDone, setTourDone] = useState(false);
  const userPick = useRef(false);
  const sending = useRef(false);
  const copyRef = useRef(t);
  copyRef.current = t;
  const touring = params.get("tour") === "1";

  useEffect(() => {
    if (!dossier) return;
    const messages = copyRef.current;
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
        const ready = await poll(body.id || "", messages.readFail);
        if (cancelled) return;
        if (!ready) {
          setError(messages.slow);
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
        setError(body.error || body.session?.error || messages.readFail);
        setPhase("error");
        return;
      }
      setData(body);
      setReread(body.session.reread);
      setPhase("ready");
    };
    void load().catch((reason: unknown) => {
      if (cancelled) return;
      setError(reason instanceof Error ? reason.message : messages.readFail);
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

  useEffect(() => {
    if (!touring) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelector<HTMLElement>(`[data-tour="${tourKeys[tourStep]}"]`);
    if (!target) return;
    const tall = target.getBoundingClientRect().height > window.innerHeight * 0.7;
    target.scrollIntoView({ block: tall ? "start" : "center", behavior: motion ? "auto" : "smooth" });
  }, [touring, tourStep, phase]);

  function closeTour() {
    const next = new URLSearchParams(params);
    next.delete("tour");
    setParams(next, { replace: true });
    if (touring) {
      setTourDone(true);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  if (!dossier) {
    return (
      <Shell>
        <h1>{t.notFound}</h1>
        <div className="gold-rule" />
        <p><Link to="/">{t.toCases}</Link></p>
      </Shell>
    );
  }
  if (phase === "loading") {
    return <Shell><Loader label={t.loading} hint={t.loadingHint} /></Shell>;
  }
  if (phase === "error" || !data || !derivation) {
    return (
      <Shell>
        <h1>{caseTitle(dossier.id, t)}</h1>
        <p className="bad" role="alert">{error || t.readFail}</p>
        <button className="btn" type="button" onClick={() => setAttempt((value) => value + 1)}>{t.retry}</button>
      </Shell>
    );
  }

  const done = new Set(["intake", "extract", "conflict", "ai", "audit", "evaluation"]);
  if (decisionEvent) done.add("review");
  if (sealEvent) done.add("integrity");
  const covered = derivation.fields.filter((field) => field.status === "filled" || (field.status === "conflict" && field.segmentIds.length >= 2)).length;
  const efficiency = sittingTime(derivationEvent?.createdAt, decisionEvent?.createdAt, now, t);
  const model = extractionEvent ? String(readPayload(extractionEvent).model ?? "") : "";
  const sealText = sealEvent ? String(readPayload(sealEvent).pruefvermerk ?? "") : "";
  const verifyHref = sealEvent ? `/v/${data.session.id}#${sealEvent.hash}` : "";
  const lines = proposalLines(derivation, dossier, t);
  const activeTour = touring ? tourKeys[tourStep] : "";
  const verdict = decisionEvent
    ? readPayload(decisionEvent).decision === "reject"
      ? t.held
      : derivation.recommendation === "hold"
        ? t.holdConfirmed
        : t.approved
    : "";

  async function send(decision: "approve" | "reject") {
    if (!data || sending.current) return;
    sending.current = true;
    setSaving(true);
    const response = await fetch(`/api/sessions/${data.session.id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, comment, decision }),
    });
    const body = (await response.json()) as Payload;
    if (body.session) setData(body);
    else setError(body.error || t.saveFail);
    setSaving(false);
    sending.current = false;
  }

  async function again() {
    if (!data) return;
    setSaving(true);
    const response = await fetch(`/api/sessions/${data.session.id}/reread`, { method: "POST" });
    const body = (await response.json()) as Reread & { error?: string };
    if (response.ok && typeof body.match === "boolean") setReread(body);
    else setError(body.error || t.rereadFail);
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
      {touring ? (
        <div className="tour">
          <strong>{t.tourProgress(tourStep + 1)}</strong>
          <p>{(decisionEvent ? t.tourLinesSealed : t.tourLines)[tourStep]}</p>
          <div className="actions">
            <button className="btn ghost" type="button" disabled={tourStep === 0} onClick={() => setTourStep((value) => value - 1)}>{t.back}</button>
            <button className="btn" type="button" onClick={() => (tourStep === 3 ? closeTour() : setTourStep((value) => value + 1))}>{tourStep === 3 ? t.tourDone : t.next}</button>
            <button className="btn ghost" type="button" onClick={closeTour}>{t.skip}</button>
          </div>
        </div>
      ) : null}
      <h1>{caseTitle(dossier.id, t)}</h1>
      <div className="gold-rule" />
      <ol className="rail" aria-label={t.steps[0]}>
        {railIds.map((id, index) => {
          const active = railIds.find((item) => !done.has(item));
          return <li key={id} className={done.has(id) ? "is-done" : id === active ? "is-now" : ""}>{t.rail[index]}</li>;
        })}
      </ol>
      {tourDone ? <p className="tour-done" role="status">{t.tourDoneNote}</p> : null}
      <div className="workspace">
        <section data-tour="docs" data-tour-active={activeTour === "docs" ? "true" : undefined}>
          <p className="step-note"><span>1</span>{t.stepNames[0]}</p>
          {dossier.documents.map((doc) => (
            <article key={doc.id} className="doc">
              <h2>{docTitle(doc.id, doc.title, t)}</h2>
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
          <div data-tour="fields" data-tour-active={activeTour === "fields" ? "true" : undefined}>
            <p className="step-note"><span>2</span>{t.stepNames[1]}</p>
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
          </div>
          <div className="draft">
            <h2>{t.proposal}: {derivation.recommendation === "hold" ? t.hold : t.book}</h2>
            {lines.length ? (
              <ul className="bullets">
                {lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
          </div>
          {sealText ? (
            <div className="vermerk" data-tour="decision" data-tour-active={activeTour === "decision" ? "true" : undefined}>
              <p className="step-note"><span>3</span>{t.stepNames[2]}</p>
              <h2>{verdict}</h2>
              <p className="claim">{t.storedWording}: <span className="quote">{sealText}</span></p>
              <p><a href={verifyHref}>{t.openProof}</a></p>
            </div>
          ) : (
            <form className="decision" data-tour="decision" data-tour-active={activeTour === "decision" ? "true" : undefined} onSubmit={(event) => event.preventDefault()}>
              <p className="step-note"><span>3</span>{t.stepNames[2]}</p>
              <label htmlFor="reviewer-name">{t.name}</label>
              <input id="reviewer-name" value={name} placeholder={t.decideHint} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              <label htmlFor="reviewer-comment">{t.comment}</label>
              <textarea id="reviewer-comment" value={comment} onChange={(event) => setComment(event.target.value)} rows={3} />
              <p className="claim">{t.claim}</p>
              <div className="actions">
                <button className="btn" type="button" disabled={saving || name.trim().length < 1} onClick={() => void send("approve")}>{t.approve}</button>
                <button className="btn ghost" type="button" disabled={saving || name.trim().length < 1} onClick={() => void send("reject")}>{t.reject}</button>
              </div>
            </form>
          )}
        </section>
      </div>
      {error ? <p className="bad" role="alert">{error}</p> : null}
      <section className="kpi" aria-label={t.kpiTitle}>
        <h2>{t.kpiTitle}</h2>
        <div className="kpi-grid">
          <div className="kpi-cell"><span>{t.time}</span>{efficiency}</div>
          <div className="kpi-cell"><span>{t.cited}</span>{covered}/8</div>
          <div className="kpi-cell"><span>{t.decision}</span>{verdict || t.none_decided}</div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn ghost" type="button" disabled={saving} onClick={() => void again()}>{t.reread}{reread ? `: ${reread.match ? t.yes : t.no}` : ""}</button>
          <button className="btn ghost" type="button" disabled={saving} onClick={() => freshReading(dossier.id, () => setAttempt((value) => value + 1))}>{t.fresh}</button>
        </div>
      </section>
      <section data-tour="audit" data-tour-active={activeTour === "audit" ? "true" : undefined}>
        <p className="step-note"><span>4</span>{t.stepNames[3]}</p>
        <ol className="tape">
          {data.events.map((event) => (
            <li key={event.seq}>{t.events[event.type as keyof Copy["events"]] ?? event.type} | {zurich(event.createdAt)} | {event.hash.slice(0, 12)}{event.type === "extraction" ? ` | ${model}` : ""}</li>
          ))}
        </ol>
      </section>
      <section className="downloads">
        <h2>{t.files}</h2>
        {downloads(lang, t).map((file) => (
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
  const { t } = useI18n();
  const amount = field.id === "net" || field.id === "vatRate" || field.id === "gross";
  const warn = field.status === "conflict"
    ? clashDocs(field, dossier, t)
    : field.status !== "filled" && vatCleared && amount
      ? t.emptyAmounts
      : "";
  const badge = field.status === "filled" ? t.ok : field.status === "conflict" ? t.conflict : t.missing;
  return (
    <div className={field.segmentIds.includes(selected) ? "field is-on" : "field"}>
      <div className="field-head">
        <span className="label">{fieldLabel(field.id, t)}</span>
        <span className={`badge ${field.status}`}>{badge}</span>
      </div>
      <div className="field-body">
        <span className="value">{field.value ?? "-"}</span>
        <span className="chips">
          {field.segmentIds.map((id) => (
            <button key={id} type="button" className={id === selected ? "chip is-on" : "chip"} onClick={() => onPick(id)}>{id}</button>
          ))}
        </span>
      </div>
      {warn ? <span className="warn">{warn}</span> : null}
    </div>
  );
}

async function poll(id: string, fail: string): Promise<Payload | null> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch(`/api/sessions/${id}`);
    const body = (await response.json()) as Payload;
    if (body.session?.status === "ready") return body;
    if (body.session?.status === "error") throw new Error(body.session.error || fail);
  }
  return null;
}

export function Verify() {
  const { sessionId = "" } = useParams();
  const { t } = useI18n();
  const [state, setState] = useState<"wait" | "green" | "red">("wait");
  const [detail, setDetail] = useState("");
  const [sealed, setSealed] = useState<{ dossierId: string; dossier: string; when: string; decision: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const response = await fetch(`/api/sessions/${sessionId}`);
      const body = (await response.json()) as Payload;
      if (!body.events) {
        if (!cancelled) {
          setState("red");
          setDetail(t.sessionMissing);
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
      const payload = seal ? readPayload(seal) : {};
      setSealed({
        dossierId: body.session.dossierId,
        dossier: caseTitle(body.session.dossierId, t),
        when: seal ? zurich(seal.createdAt) : "-",
        decision: payload.decision === "reject" ? t.held : t.approved,
      });
      setState(checked.ok && fragmentOk ? "green" : "red");
      setDetail(checked.ok && fragmentOk ? t.linkOk : t.linkBad);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, t.linkBad, t.linkOk, t.sessionMissing, t.held, t.approved]);

  return (
    <Shell>
      <h1>{t.integrity}</h1>
      <div className="gold-rule" />
      {state === "wait" ? <Loader label={t.checking} /> : (
        <>
          <p className={state === "green" ? "ok" : "bad"}>{detail}</p>
          {sealed && state === "green" ? (
            <div className="kpi-grid">
              <div className="kpi-cell"><span>{t.caseLabel}</span>{sealed.dossier}</div>
              <div className="kpi-cell"><span>{t.decision}</span>{sealed.decision}</div>
              <div className="kpi-cell"><span>{t.time}</span>{sealed.when}</div>
            </div>
          ) : null}
        </>
      )}
      <p className="claim">{t.noStamp}</p>
      {sealed ? <p><Link to={`/fall/${sealed.dossierId}`}>{t.backToCase}</Link></p> : null}
    </Shell>
  );
}

export function NotFound() {
  const { t } = useI18n();
  return (
    <Shell>
      <h1>{t.notFound}</h1>
      <div className="gold-rule" />
      <p><Link to="/">{t.toCases}</Link></p>
    </Shell>
  );
}

export function BrokenChain() {
  const { t } = useI18n();
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
      <h1>{t.brokenTitle}</h1>
      <div className="gold-rule" />
      {state === "wait" ? <p>{t.brokenWait}</p> : <p className={state === "red" ? "bad" : "ok"}>{state === "red" ? t.brokenRed : t.brokenGreen}</p>}
    </Shell>
  );
}
