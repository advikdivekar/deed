import type { Call, Closure, Fix, Unit } from "./types";

/** US survey conventions. Vara is the Texas vara (33 1/3 in). Mirrors deedreader/geo.py. */
export const FEET_PER: Record<Unit, number> = { ft: 1, chain: 66, pole: 16.5, vara: 100 / 36, link: 0.66, m: 1 / 0.3048006096 };
export const UNIT_LABEL: Record<Unit, string> = { ft: "feet", chain: "chains", pole: "poles", vara: "varas", link: "links", m: "meters" };
/** A parcel "closes" when perimeter / misclosure is at least this. 1:5,000 is a common rural boundary standard; make it configurable per jurisdiction. */
export const CLOSE_RATIO = 5_000;

export const toFeet = (dist: number, unit: Unit) => dist * FEET_PER[unit];

export function azimuthDeg(c: Pick<Call, "ns" | "deg" | "min" | "sec" | "ew">): number {
  const a = c.deg + c.min / 60 + c.sec / 3600;
  if (c.ns === "N") return c.ew === "E" ? a : 360 - a;
  return c.ew === "E" ? 180 - a : 180 + a;
}

const segArea = (chord: number, r: number) => { const th = 2 * Math.asin(Math.min(1, chord / (2 * r))); return (r * r / 2) * (th - Math.sin(th)); };

export function closure(calls: Call[]): Closure {
  const points = [{ x: 0, y: 0 }];
  let perimeter = 0, seg = 0;
  for (const c of calls) {
    const az = (azimuthDeg(c) * Math.PI) / 180, d = toFeet(c.dist, c.unit);
    const p = points[points.length - 1];
    points.push({ x: p.x + d * Math.sin(az), y: p.y + d * Math.cos(az) });
    const r = c.type === "curve" && c.radius ? toFeet(c.radius, c.radiusUnit ?? c.unit) : 0;
    if (r >= d / 2 && r > 0) {
      seg += c.turn === "R" ? segArea(d, r) : -segArea(d, r); // center on the right => arc bulges left => adds CCW area
      perimeter += 2 * r * Math.asin(Math.min(1, d / (2 * r)));
    } else perimeter += d;
  }
  const end = points[points.length - 1];
  const misclosure = Math.hypot(end.x, end.y);
  const ratio = misclosure < 1e-9 ? Infinity : perimeter / misclosure;
  let twice = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; twice += a.x * b.y - b.x * a.y; }
  const areaSqFt = Math.abs(twice / 2 + seg);
  return { points, misclosure, ratio, perimeter, areaSqFt, acres: areaSqFt / 43_560, closed: calls.length >= 3 && ratio >= CLOSE_RATIO };
}

/** Points along the minor arc a->b. turn = side the radius point lies on. Y up. */
export function arcPoints(a: { x: number; y: number }, b: { x: number; y: number }, radiusFt: number, turn: "L" | "R", n = 28) {
  const c = Math.hypot(b.x - a.x, b.y - a.y);
  const h = Math.sqrt(Math.max(radiusFt ** 2 - (c / 2) ** 2, 0));
  const ux = (b.x - a.x) / c, uy = (b.y - a.y) / c, s = turn === "R" ? 1 : -1;
  const cx = (a.x + b.x) / 2 + s * uy * h, cy = (a.y + b.y) / 2 - s * ux * h;
  const a1 = Math.atan2(a.y - cy, a.x - cx), a2 = Math.atan2(b.y - cy, b.x - cx);
  const d = ((a2 - a1 + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return Array.from({ length: n + 1 }, (_, i) => ({ x: cx + radiusFt * Math.cos(a1 + (d * i) / n), y: cy + radiusFt * Math.sin(a1 + (d * i) / n) }));
}

const swaps = (s: string) => {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === s[i + 1] || s[i] === "." || s[i + 1] === ".") continue;
    out.add(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2));
  }
  return [...out];
};

/** Try every single-field perturbation of every call; keep those that close the parcel, best first. */
export function findFixes(calls: Call[], limit = 3): Fix[] {
  const found: Fix[] = [];
  const consider = (c: Call, field: Fix["field"], label: string, patch: Partial<Call>) => {
    const r = closure(calls.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
    if (r.closed) found.push({ callId: c.id, field, label, patch, ratio: r.ratio, misclosure: r.misclosure });
  };
  const fN = (v: "N" | "S") => (v === "N" ? "S" : "N"), fE = (v: "E" | "W") => (v === "E" ? "W" : "E");
  for (const c of calls) {
    consider(c, "bearing", `flip ${c.ns}→${fN(c.ns)}`, { ns: fN(c.ns) });
    consider(c, "bearing", `flip ${c.ew}→${fE(c.ew)}`, { ew: fE(c.ew) });
    consider(c, "bearing", "flip both", { ns: fN(c.ns), ew: fE(c.ew) });
    for (const s of swaps(String(c.deg))) if (Number(s) < 90) consider(c, "bearing", `degrees ${c.deg} → ${s}`, { deg: Number(s) });
    for (const s of swaps(String(c.min).padStart(2, "0"))) if (Number(s) < 60) consider(c, "bearing", `minutes ${c.min} → ${Number(s)}`, { min: Number(s) });
    for (const s of swaps(String(c.dist))) consider(c, "distance", `distance ${c.dist} → ${Number(s)}`, { dist: Number(s) });
  }
  return found.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}

export const fmtBearing = (c: Pick<Call, "ns" | "deg" | "min" | "sec" | "ew">) =>
  `${c.ns} ${c.deg}°${String(c.min).padStart(2, "0")}'${c.sec ? String(c.sec).padStart(2, "0") + '"' : ""} ${c.ew}`;

/** Short form for tight spaces: 1:2.9M instead of 1:2,862,678. */
export const fmtRatioShort = (r: number) => (r === Infinity ? "exact" : r >= 1e6 ? `1:${(r / 1e6).toFixed(1)}M` : `1:${Math.round(r).toLocaleString("en-US")}`);
export const fmtRatio = (r: number) => (r === Infinity ? "exact" : `1:${Math.round(r).toLocaleString("en-US")}`);

export function summary(calls: Call[], c: Closure): string {
  const curves = calls.filter((x) => x.type === "curve").length;
  const sides = `${calls.length}-sided parcel${curves ? ` (${curves} curved)` : ""}`;
  const area = c.acres >= 1 ? `${c.acres.toFixed(2)} acres` : `${c.acres.toFixed(3)} acres (${Math.round(c.areaSqFt).toLocaleString("en-US")} sq ft)`;
  return c.closed
    ? `${sides}, ${area}, ${Math.round(c.perimeter).toLocaleString("en-US")} ft around, closes at ${fmtRatio(c.ratio)}.`
    : `${sides}, does NOT close: off by ${c.misclosure.toFixed(1)} ft (${fmtRatio(c.ratio)}). Area ${area} is unreliable.`;
}
