"use client";
import { AlertTriangle, ArrowRight, Bug, Check, Copy, Download, Pencil, ScanText, Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { clauses as findClauses, runChecks } from "@/lib/ground";
import { decodeCompact } from "@/lib/compact";
import { demoRead } from "@/lib/parse";
import { loadReplays, PRICE, type Replay } from "@/lib/replays";
import { SAMPLES } from "@/lib/samples";
import { toDXF, toGeoJSON, download } from "@/lib/exporters";
import { closure, findFixes, fmtRatio, summary, UNIT_LABEL } from "@/lib/survey";
import type { Call, Deed, Fix, Unit } from "@/lib/types";
import { ChecksCard } from "./checks";
import { DeedText } from "./deed-text";
import { Gauge } from "./gauge";
import { Plot, plotToSvg } from "./plot";
import { placeFor, type LatLon } from "@/lib/mapgeo";
import type { Basemap } from "./map-view";
import { Badge, Button, Card, cx, inputCls, SectionTitle, Tabs } from "./ui";

const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), { ssr: false, loading: () => <div className="skeleton h-[26rem] rounded-lg sm:h-[32rem]" /> });

type Tab = "map" | "drawing" | "calls" | "closure" | "json";
type Origin = "replay" | "demo";
type Item = { id: string; title: string; blurb: string; text: string; replay?: Replay; badge?: string };
const UNITS = Object.keys(UNIT_LABEL) as Unit[];

export function Studio() {
  const [items, setItems] = useState<Item[]>(SAMPLES.map((s) => ({ id: s.id, title: s.title, blurb: s.blurb, text: s.text })));
  const [text, setText] = useState(SAMPLES[0].text);
  const [deed, setDeed] = useState<Deed | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [minLp, setMinLp] = useState<number | null>(null);
  const [tokens, setTokens] = useState<[number, number] | null>(null);
  const [origin, setOrigin] = useState<Origin>("demo");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(true);
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<number | null>(null);
  const [approved, setApproved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [coords, setCoords] = useState("");
  const place = useMemo(() => placeFor(text, /vara/i.test(text) ? "varas" : /pole/i.test(text) ? "poles" : undefined), [text]);
  const custom = useMemo<LatLon | null>(() => { const m = coords.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/); if (!m) return null; const a = +m[1], b = +m[2]; return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null; }, [coords]);
  const at: LatLon = custom ?? place.at;
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    loadReplays().then((rs) => {
      if (!rs.length) return;
      const its: Item[] = rs.map((r) => ({ id: r.id, title: r.title, blurb: r.blurb, text: r.text, replay: r, badge: r.heldout ? "new style" : undefined }));
      setItems([...its, ...SAMPLES.map((s) => ({ id: s.id, title: s.title, blurb: s.blurb, text: s.text }))]);
      setText(its[0].text);
    });
  }, []);

  const result = useMemo(() => (deed?.calls.length ? closure(deed.calls) : null), [deed]);
  const fixes = useMemo(() => (deed && result && !result.closed ? findFixes(deed.calls) : []), [deed, result]);
  const source = deed?.source ?? text;
  const checks = useMemo(() => (deed ? runChecks(source, deed.calls, parseErrors, minLp) : []), [deed, source, parseErrors, minLp]);
  const clauses = useMemo(() => (deed ? findClauses(source, deed.calls.length) : null), [deed, source]);
  const bad = useMemo(() => new Set(checks.flatMap((c) => c.detail).map((d) => /^call (\d+):/.exec(d)?.[1]).filter(Boolean).map(Number)), [checks]);
  const review = checks.some((c) => !c.ok);
  const say = (m: string) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2800); };

  async function read() {
    setBusy(true); setApproved(false); setSelected(null);
    await new Promise((r) => setTimeout(r, 900)); // let the scan play
    const hit = items.find((i) => i.replay && i.text === text)?.replay;
    if (hit) {
      const d = decodeCompact(hit.output);
      setDeed({ pob: d.pob, calls: d.calls, source: hit.text }); setParseErrors(d.errors); setMinLp(hit.minlp_num); setTokens([hit.n_prompt, hit.n_out]); setOrigin("replay");
    } else { setDeed(demoRead(text)); setParseErrors([]); setMinLp(null); setTokens(null); setOrigin("demo"); }
    setBusy(false); setTab("map"); setEditing(false); setRun((n) => n + 1);
  }
  const patchCall = (id: number, patch: Partial<Call>) => { setApproved(false); setDeed((d) => d && { ...d, calls: d.calls.map((c) => (c.id === id ? { ...c, ...patch } : c)) }); };
  const apply = (f: Fix) => { patchCall(f.callId, f.patch); say(`Call ${f.callId}: ${f.label}`); };

  function misread() { // simulate the failure we care about: the reader gets one call subtly wrong
    if (!deed) return;
    const c = deed.calls[Math.floor(Math.random() * Math.max(1, deed.calls.length - 1))];
    const s = String(c.dist), i = s.split("").findIndex((ch, k) => /\d/.test(ch) && /\d/.test(s[k + 1] ?? "") && ch !== s[k + 1]);
    const patch: Partial<Call> = i >= 0 ? { dist: Number(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2)) } : { ns: c.ns === "N" ? "S" : "N" };
    patchCall(c.id, patch); setSelected(c.id); say(`Simulated misread on call ${c.id}`);
  }

  const json = deed && result ? JSON.stringify({ point_of_beginning: deed.pob, calls: deed.calls.map(({ span, ...c }) => c), closure: { misclosure_ft: +result.misclosure.toFixed(3), ratio: result.ratio === Infinity ? null : Math.round(result.ratio), area_sqft: Math.round(result.areaSqFt), acres: +result.acres.toFixed(4), closed: result.closed }, status: review ? "NEEDS HUMAN REVIEW" : "OK" }, null, 2) : "";
  const copy = async (s: string, m: string) => { try { await navigator.clipboard.writeText(s); say(m); } catch { say("Copy failed. Select the text instead."); } };
  const svg = () => { const el = document.getElementById("parcel-plot") as SVGSVGElement | null; return el ? plotToSvg(el) : ""; };
  const cost = tokens ? tokens[0] * PRICE.prefill + tokens[1] * PRICE.sample : null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow mb-2">Studio</p><h1 className="text-[28px] font-light leading-tight sm:text-4xl">Paste the deed. <span className="text-accent-text">Glance. Approve.</span></h1></div>
        <ModePill origin={origin} hasDeed={!!deed} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card className="h-fit lg:sticky lg:top-20">
          <SectionTitle hint={deed && !editing ? "Click a numbered clause to find its leg in the drawing." : "A metes-and-bounds legal description, from a deed, plat or title commitment."}
            action={deed && !editing ? <button onClick={() => setEditing(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium hover:bg-surface-2"><Pencil className="size-3.5" aria-hidden />Edit text</button> : undefined}>Legal description</SectionTitle>
          {deed && !editing ? (
            <div className="relative rounded-[10px] bg-surface-2/50 p-3.5 ring-1 ring-border"><DeedText text={source} clauses={clauses} selected={selected} bad={bad} onSelect={setSelected} /></div>
          ) : (
            <div className="relative">
              <label htmlFor="deed" className="sr-only">Legal description text</label>
              <textarea id="deed" value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} placeholder="Beginning at an iron pin at the NW corner of Smith's lot, thence N 42°15' E 118.5 feet to a stone…" className={cx(inputCls, "resize-y font-mono text-[14px] leading-relaxed")} />
              {busy && <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]" aria-hidden><div className="scan-line absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-accent/30 to-transparent" /></div>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sample deeds">
            {items.map((s) => (
              <button key={s.id} type="button" onClick={() => { setText(s.text); setDeed(null); setEditing(true); }} title={s.blurb}
                className={cx("inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 transition active:scale-[0.96]", text === s.text ? "bg-primary text-primary-fg ring-transparent" : "bg-surface text-foreground ring-border-strong hover:ring-foreground/40")}>
                {s.title}{s.badge && <span className="rounded-full bg-accent/20 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text">{s.badge}</span>}
              </button>
            ))}
          </div>
          <Button variant="accent" className="mt-5 w-full" busy={busy} disabled={!text.trim()} onClick={read}><ScanText className="size-4" aria-hidden />Read deed<ArrowRight className="size-4" aria-hidden /></Button>
          <p className="mt-3 text-xs text-muted">Nothing is uploaded in demo or replay mode. With the local model, deeds never leave your machine.</p>
        </Card>

        <div className="min-w-0">
          {!deed && !busy && <Empty />}
          {busy && <div className="skeleton h-[28rem] rounded-xl" aria-label="Reading deed" />}
          {deed && !busy && (result ? (
            <div className="anim-in space-y-4">
              <Verdict review={review} result={result} approved={approved} firstIssue={(() => { const f = checks.find((c) => !c.ok); return f ? `failed check: ${f.label.toLowerCase()}` : undefined; })()} />
              <p className="px-1 text-[15px] leading-snug">{summary(deed.calls, result)}</p>
              <Tabs label="Result views" value={tab} onChange={setTab} tabs={[{ id: "map", label: "Map" }, { id: "drawing", label: "Drawing" }, { id: "calls", label: "Calls", badge: deed.calls.length }, { id: "closure", label: "Closure" }, { id: "json", label: "JSON" }]} />

              {tab === "map" && (
                <Card pad={false} className="overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-xs">
                    <span className="text-muted">{custom ? "Placed at your coordinates" : `Illustrative location: ${place.name}`}. The parcel is fictional; bearings and distances are true.</span>
                    <span className="flex gap-1" role="group" aria-label="Basemap">
                      {(["satellite", "street"] as Basemap[]).map((b) => <button key={b} type="button" onClick={() => setBasemap(b)} aria-pressed={basemap === b} className={cx("min-h-8 rounded-full px-3 font-medium capitalize ring-1 transition", basemap === b ? "bg-primary text-primary-fg ring-transparent" : "ring-border-strong hover:ring-foreground/40")}>{b}</button>)}
                    </span>
                  </div>
                  <div className="p-2 sm:p-3"><MapView calls={deed.calls} result={result} origin={at} basemap={basemap} selected={selected} onSelect={setSelected} /></div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted">
                    <label className="flex items-center gap-2">Move to lat, lon <input value={coords} onChange={(e) => setCoords(e.target.value)} placeholder={`${at[0].toFixed(4)}, ${at[1].toFixed(4)}`} className="w-44 rounded-md bg-surface px-2 py-1 font-mono ring-1 ring-border-strong" /></label>
                    <span>{selected ? `Call ${selected} highlighted` : "Tap a leg or a clause to link them"}</span>
                  </div>
                </Card>
              )}
              {tab === "drawing" && (
                <Card pad={false} className="overflow-hidden">
                  <div className="p-2 sm:p-4"><Plot calls={deed.calls} result={result} selected={selected} onSelect={setSelected} animateKey={String(run)} /></div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-muted">
                    <span>{selected ? `Call ${selected} highlighted` : "Tap a line or a clause to link them"}</span>
                    <span className="flex gap-1">
                      <ExportBtn onClick={() => download("parcel.svg", "image/svg+xml", svg())}>SVG</ExportBtn>
                      <ExportBtn onClick={() => download("parcel.dxf", "application/dxf", toDXF(deed.calls, result))}>DXF</ExportBtn>
                      <ExportBtn onClick={() => download("parcel.geojson", "application/geo+json", toGeoJSON(deed.calls, result))}>GeoJSON</ExportBtn>
                    </span>
                  </div>
                </Card>
              )}
              {tab === "calls" && <CallsTable calls={deed.calls} pob={deed.pob} selected={selected} bad={bad} onSelect={setSelected} onPatch={patchCall} />}
              {tab === "closure" && <ClosureCard result={result} />}
              {tab === "json" && (
                <Card pad={false}>
                  <div className="flex items-center justify-between border-b border-border px-4 py-2.5"><span className="eyebrow">Structured output</span>
                    <button onClick={() => copy(json, "JSON copied")} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium hover:bg-surface-2"><Copy className="size-3.5" aria-hidden />Copy</button></div>
                  <pre className="max-h-[28rem] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed">{json}</pre>
                </Card>
              )}

              <ChecksCard checks={checks} />
              {fixes.length > 0 && <FixCard fixes={fixes} onApply={apply} />}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant={review ? "ghost" : "primary"} className="sm:flex-1" onClick={() => { setApproved(true); copy(json, "Approved · JSON copied"); }}>
                  <Check className="size-4" aria-hidden />{review ? "Approve anyway (I checked it)" : "Looks right: approve"}
                </Button>
                <Button variant="ghost" onClick={misread} title="Corrupt one call the way a reader could, and watch the checks catch it"><Bug className="size-4" aria-hidden />Simulate a misread</Button>
              </div>
              {cost !== null && <p className="px-1 text-xs text-muted">Reading this deed took {tokens![0]} prompt + {tokens![1]} output tokens, about <span className="font-mono">${cost.toFixed(5)}</span> at Tinker&apos;s list price. The closure math is free.</p>}
            </div>
          ) : <NoCalls />)}
        </div>
      </div>
      {toast && <div role="status" className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[90vw] items-center gap-2 rounded-full bg-surface px-5 py-3 text-sm font-medium shadow-float ring-1 ring-border" style={{ animation: "toast-in .25s ease both" }}><Check className="size-4 text-ok" aria-hidden />{toast}</div>}
    </main>
  );
}

const ExportBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button onClick={onClick} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 font-medium text-foreground hover:bg-surface-2"><Download className="size-3.5" aria-hidden />{children}</button>;

function ModePill({ origin, hasDeed }: { origin: Origin; hasDeed: boolean }) {
  const replay = hasDeed && origin === "replay";
  return (
    <div className="flex max-w-md items-start gap-2.5 text-[13px]" role="status">
      <span className="relative mt-1.5 flex size-2 shrink-0"><span className={cx("relative inline-flex size-2 rounded-full", replay ? "bg-ok" : "bg-warn")} /></span>
      <span><span className="font-medium">{replay ? "Replay of the tuned model" : "Demo reader"}</span><span className="text-muted"> · {replay ? "recorded output on a test deed it never saw in training. Checks run live." : "regex reader for plain “N 41°00' E 121.9 feet” calls. Pick a replay sample to see the real model."}</span></span>
    </div>
  );
}

function Empty() {
  return (
    <Card className="grid min-h-[22rem] place-items-center text-center">
      <div className="max-w-xs"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-text"><ScanText className="size-6" aria-hidden /></div>
        <p className="font-medium">Your parcel will appear here</p><p className="mt-1 text-sm text-muted">Pick a sample or paste a description, then press Read deed.</p></div>
    </Card>
  );
}
const NoCalls = () => <Card><p className="font-medium">No calls found.</p><p className="mt-1 text-sm text-muted">The demo reader only understands calls like “N 41°00' E 121.9 feet”. The tuned model reads prose, spelled-out numbers and OCR noise.</p></Card>;

function Verdict({ review, result, approved, firstIssue }: { review: boolean; result: ReturnType<typeof closure>; approved: boolean; firstIssue?: string }) {
  return (
    <div className={cx("flex items-center gap-4 rounded-xl px-4 py-3 ring-1", !review ? "bg-ok/10 ring-ok/30" : "bg-warn/10 ring-warn/40")} role="status">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className={cx("grid size-8 shrink-0 place-items-center rounded-full", !review ? "bg-ok text-surface" : "bg-warn text-surface")}>{!review ? <Check className="size-4.5" aria-hidden /> : <AlertTriangle className="size-4.5" aria-hidden />}</span>
          <p className={cx("font-mono text-[12px] font-semibold uppercase tracking-wider", !review ? "text-ok" : "text-warn")}>{!review ? "All checks pass" : "Needs human review"}</p>
          {approved && <Badge tone="ok">Approved</Badge>}
        </div>
        <p className="tnum mt-1.5 text-sm">Misclosure {result.misclosure.toFixed(2)} ft{review && firstIssue ? ` · ${firstIssue}` : ""}</p>
      </div>
      <Gauge ratio={result.ratio} />
    </div>
  );
}

function FixCard({ fixes, onApply }: { fixes: Fix[]; onApply: (f: Fix) => void }) {
  return (
    <Card className="ring-warn/40">
      <SectionTitle hint="Every single-field change (quadrant flips, transposed digits) was tried against the closure check.">Most likely wrong call</SectionTitle>
      <ul className="divide-y divide-border">
        {fixes.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div><p className="text-sm font-medium">Call {f.callId}: {f.label}</p><p className="tnum text-xs text-muted">Closes at {fmtRatio(f.ratio)} · misclosure {f.misclosure.toFixed(2)} ft</p></div>
            <Button variant="ghost" className="min-h-10" onClick={() => onApply(f)}><Wand2 className="size-4" aria-hidden />Apply</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CallsTable({ calls, pob, selected, bad, onSelect, onPatch }: { calls: Call[]; pob: string; selected: number | null; bad: Set<number>; onSelect: (id: number | null) => void; onPatch: (id: number, p: Partial<Call>) => void }) {
  const cell = "w-full rounded-md bg-surface px-2 py-1.5 font-mono text-[13px] ring-1 ring-border-strong focus:outline-none focus:ring-2 focus:ring-foreground";
  const num = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(+v || 0)));
  return (
    <Card pad={false}>
      <div className="border-b border-border px-4 py-3"><p className="eyebrow">Point of beginning</p><p className="mt-0.5 text-sm">{pob || "—"}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="eyebrow"><tr><th className="px-4 py-2 font-normal">#</th><th className="py-2 font-normal">Bearing</th><th className="py-2 font-normal">Distance</th><th className="py-2 font-normal">Unit</th><th className="px-4 py-2 font-normal">To</th></tr></thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} onClick={() => onSelect(selected === c.id ? null : c.id)} className={cx("cursor-pointer border-t border-border align-middle", selected === c.id && "bg-terra/10", bad.has(c.id) && "bg-danger/5")}>
                <td className="tnum px-4 py-2 text-muted">{c.id}{c.type === "curve" && <span title={`curve, radius ${c.radius} ${c.radiusUnit}, ${c.turn === "R" ? "right" : "left"}`} className="ml-1 text-accent-text">⌒</span>}</td>
                <td className="py-2 pr-3"><div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <select aria-label={`Call ${c.id} north or south`} value={c.ns} onChange={(e) => onPatch(c.id, { ns: e.target.value as "N" | "S" })} className={cx(cell, "w-12")}><option>N</option><option>S</option></select>
                  <input aria-label={`Call ${c.id} degrees`} inputMode="numeric" value={c.deg} onChange={(e) => onPatch(c.id, { deg: num(e.target.value, 90) })} className={cx(cell, "w-12 text-right")} />°
                  <input aria-label={`Call ${c.id} minutes`} inputMode="numeric" value={c.min} onChange={(e) => onPatch(c.id, { min: num(e.target.value, 59) })} className={cx(cell, "w-12 text-right")} />′
                  <select aria-label={`Call ${c.id} east or west`} value={c.ew} onChange={(e) => onPatch(c.id, { ew: e.target.value as "E" | "W" })} className={cx(cell, "w-12")}><option>E</option><option>W</option></select>
                </div></td>
                <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}><input aria-label={`Call ${c.id} distance`} inputMode="decimal" defaultValue={c.dist} key={c.dist} onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0 && v !== c.dist) onPatch(c.id, { dist: v }); }} className={cx(cell, "w-24 text-right")} /></td>
                <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}><select aria-label={`Call ${c.id} unit`} value={c.unit} onChange={(e) => onPatch(c.id, { unit: e.target.value as Unit })} className={cell}>{UNITS.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select></td>
                <td className="px-4 py-2 text-[13px] text-muted">{c.ref ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted">Edit any field and the drawing, closure and checks update at once.</p>
    </Card>
  );
}

function ClosureCard({ result }: { result: ReturnType<typeof closure> }) {
  const rows: [string, string, string?][] = [
    ["Misclosure", `${result.misclosure.toFixed(3)} ft`, "Straight-line gap between where the last call ends and the point of beginning."],
    ["Ratio of closure", fmtRatio(result.ratio), "Perimeter ÷ misclosure."],
    ["Perimeter", `${result.perimeter.toFixed(2)} ft`, "Curves count by arc length."],
    ["Area", `${Math.round(result.areaSqFt).toLocaleString("en-US")} sq ft`, "Shoelace formula on the corners, plus the circular segment of every curve."],
    ["Acres", result.acres.toFixed(4)],
  ];
  return (
    <Card>
      <dl className="divide-y divide-border">
        {rows.map(([k, v, h]) => (
          <div key={k} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"><div><dt className="text-sm font-medium">{k}</dt>{h && <dd className="mt-0.5 max-w-sm text-xs text-muted">{h}</dd>}</div><dd className="tnum font-mono text-sm">{v}</dd></div>
        ))}
      </dl>
      <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">Computed in plain code, never by the model. The model only reads the words.</p>
    </Card>
  );
}
