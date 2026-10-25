"use client";
import { arcPoints, fmtBearing, toFeet, UNIT_LABEL } from "@/lib/survey";
import type { Call, Closure } from "@/lib/types";

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** SVG parcel outline, north up. Curves are real arcs. A parcel that does not close shows its gap as a dashed terra line. */
export function Plot({ calls, result, selected, onSelect, id = "parcel-plot", animateKey }: { calls: Call[]; result: Closure; selected: number | null; onSelect: (id: number | null) => void; id?: string; animateKey?: string }) {
  const pts = result.points;
  const geom = calls.map((c, i) => {
    const a = pts[i], b = pts[i + 1];
    const r = c.type === "curve" && c.radius ? toFeet(c.radius, c.radiusUnit ?? c.unit) : 0;
    return r >= toFeet(c.dist, c.unit) / 2 && r > 0 ? arcPoints(a, b, r, c.turn ?? "R") : [a, b];
  });
  const all = geom.flat();
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 1), pad = span * 0.17, u = span / 100;
  const vb = { x: minX - pad, y: -(maxY + pad), w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  const bad = !result.closed, end = pts[pts.length - 1];
  const d = (g: { x: number; y: number }[]) => g.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(3)} ${(-p.y).toFixed(3)}`).join(" ");
  const scaleLen = niceLen(span / 4);
  const fillPath = geom.map((g, i) => (i ? g.slice(1) : g)).flat().map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(3)} ${(-p.y).toFixed(3)}`).join(" ") + " Z";

  return (
    <svg id={id} key={animateKey} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label="Plotted parcel outline" className="block h-auto w-full touch-manipulation select-none" onClick={() => onSelect(null)}>
      <defs><pattern id={`${id}-g`} width={span / 10} height={span / 10} patternUnits="userSpaceOnUse"><path d={`M ${span / 10} 0 L 0 0 0 ${span / 10}`} fill="none" stroke="currentColor" strokeOpacity=".07" strokeWidth={u * 0.15} /></pattern></defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${id}-g)`} className="text-foreground" />
      <path d={fillPath} fill="var(--accent)" fillOpacity={bad ? 0.05 : 0.16} className="late" style={{ ["--d" as string]: `${0.2 + calls.length * 0.12}s` }} />
      {calls.map((c, i) => {
        const a = pts[i], b = pts[i + 1], sel = selected === c.id;
        const mx = (a.x + b.x) / 2, my = -(a.y + b.y) / 2;
        const ang = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI, flip = ang > 90 || ang < -90;
        const mid = geom[i][Math.floor(geom[i].length / 2)], off = c.type === "curve" ? u * 3.2 : u * 1.6;
        const legLen = Math.hypot(b.x - a.x, b.y - a.y), roomy = legLen > span * 0.2 || sel;
        const lx = c.type === "curve" ? mid.x : mx, ly = c.type === "curve" ? -mid.y : my;
        return (
          <g key={c.id} onClick={(e) => { e.stopPropagation(); onSelect(sel ? null : c.id); }} className="cursor-pointer">
            <path d={d(geom[i])} fill="none" stroke="transparent" strokeWidth={u * 5} />
            <path d={d(geom[i])} fill="none" pathLength={1} stroke={sel ? "var(--terra)" : "var(--accent-text)"} strokeWidth={u * (sel ? 0.95 : 0.55)} strokeLinecap="round" strokeLinejoin="round" className="pen" style={{ ["--i" as string]: i }} />
            {!roomy && <g className="late" style={{ ["--d" as string]: `${0.5 + i * 0.12}s` }}><circle cx={mx} cy={my} r={u * 1.7} fill="var(--surface)" stroke="var(--accent-text)" strokeWidth={u * 0.3} /><text x={mx} y={my + u * 0.9} fontSize={u * 2.4} textAnchor="middle" fill="var(--foreground)" className="font-mono">{c.id}</text></g>}
            {roomy && <text x={lx} y={ly} fontSize={u * 2.4} textAnchor="middle" transform={`rotate(${flip ? ang + 180 : ang} ${lx} ${ly}) translate(0 ${-off})`} fill="var(--foreground)" className="late font-mono" style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: u * 0.7, ["--d" as string]: `${0.5 + i * 0.12}s` }}>
              {fmtBearing(c)}  {c.dist}{c.unit === "ft" ? "′" : ` ${UNIT_LABEL[c.unit].slice(0, 2)}`}{c.type === "curve" ? ` R${c.radius}` : ""}
            </text>}
          </g>
        );
      })}
      {bad && <line x1={end.x} y1={-end.y} x2={0} y2={0} stroke="var(--terra)" strokeWidth={u * 0.6} strokeDasharray={`${u * 1.6} ${u * 1.2}`} className="late" style={{ ["--d" as string]: `${0.6 + calls.length * 0.12}s` }} />}
      {pts.slice(0, bad ? pts.length : -1).map((p, i) => {
        const cx0 = xs.reduce((s, v) => s + v, 0) / xs.length, cy0 = ys.reduce((s, v) => s + v, 0) / ys.length;
        const dx = p.x - cx0, dy = p.y - cy0, dl = Math.hypot(dx, dy) || 1, lx = p.x + (dx / dl) * u * 3.4, ly = -p.y - (dy / dl) * u * 3.4;
        const crowded = pts.slice(0, i).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < u * 11);
        return (
        <g key={i} className="late" style={{ ["--d" as string]: `${0.1 + i * 0.12}s` }}>
          <circle cx={p.x} cy={-p.y} r={u * (i === 0 ? 1.7 : 1.1)} fill={i === 0 ? "var(--accent)" : "var(--surface)"} stroke={i === 0 ? "var(--surface)" : "var(--accent-text)"} strokeWidth={u * 0.4} />
          {!crowded && <text x={lx} y={ly + u * 0.9} fontSize={u * 2.7} fontWeight={600} textAnchor="middle" fill="var(--foreground)">{i === 0 ? "POB" : LABELS[(i - 1) % 26]}</text>}
        </g>
      );})}
      <g transform={`translate(${vb.x + vb.w - pad * 0.7} ${vb.y + pad * 0.9})`} fill="var(--muted)"><path d={`M0 ${-u * 3.5} L${u * 1.3} ${u * 1.5} L0 ${u * 0.5} L${-u * 1.3} ${u * 1.5} Z`} /><text y={u * 5} fontSize={u * 2.4} textAnchor="middle" className="font-mono">N</text></g>
      <g transform={`translate(${vb.x + pad * 0.6} ${vb.y + vb.h - pad * 0.55})`} fill="var(--muted)"><rect width={scaleLen} height={u * 0.5} /><text y={-u * 0.8} fontSize={u * 2.3} className="font-mono">{Math.round(scaleLen)} ft</text></g>
    </svg>
  );
}

function niceLen(raw: number) { const p = 10 ** Math.floor(Math.log10(raw)); const n = raw / p; return (n < 2 ? 1 : n < 5 ? 2 : 5) * p; }

/** Standalone SVG for download: inlines the theme colours the page takes from CSS variables. */
export function plotToSvg(el: SVGSVGElement): string {
  const css = getComputedStyle(document.documentElement);
  let s = new XMLSerializer().serializeToString(el);
  s = s.replace(/var\((--[a-z-]+)\)/g, (_, v) => css.getPropertyValue(v).trim() || "#000").replace(/class="[^"]*"/g, "").replace(/style="[^"]*opacity:0[^"]*"/g, "");
  return s.replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" style="background:${css.getPropertyValue("--surface").trim()};color:${css.getPropertyValue("--foreground").trim()};font-family:ui-monospace,monospace" `);
}
