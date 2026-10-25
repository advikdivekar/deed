import { arcPoints, toFeet } from "./survey";
import type { Call, Closure } from "./types";

function outline(calls: Call[], r: Closure) {
  const pts: { x: number; y: number }[] = [r.points[0]];
  calls.forEach((c, i) => {
    const a = r.points[i], b = r.points[i + 1];
    if (c.type === "curve" && c.radius && toFeet(c.radius, c.radiusUnit ?? c.unit) >= toFeet(c.dist, c.unit) / 2) pts.push(...arcPoints(a, b, toFeet(c.radius, c.radiusUnit ?? c.unit), c.turn ?? "R").slice(1));
    else pts.push(b);
  });
  return pts;
}

/** DXF R12 polyline in local feet (POB = 0,0), plus text labels, so the parcel opens in AutoCAD / Civil 3D / QGIS. */
export function toDXF(calls: Call[], r: Closure): string {
  const pts = outline(calls, r);
  const g = (code: number, v: string | number) => `${code}\n${v}\n`;
  let s = g(0, "SECTION") + g(2, "ENTITIES") + g(0, "POLYLINE") + g(8, "PARCEL") + g(66, 1) + g(70, r.closed ? 1 : 0);
  for (const p of pts) s += g(0, "VERTEX") + g(8, "PARCEL") + g(10, p.x.toFixed(4)) + g(20, p.y.toFixed(4)) + g(30, 0);
  s += g(0, "SEQEND") + g(8, "PARCEL");
  r.points.slice(0, -1).forEach((p, i) => { s += g(0, "TEXT") + g(8, "LABELS") + g(10, p.x.toFixed(3)) + g(20, p.y.toFixed(3)) + g(30, 0) + g(40, Math.max(r.perimeter / 120, 0.5).toFixed(2)) + g(1, i === 0 ? "POB" : String.fromCharCode(64 + i)); });
  return s + g(0, "ENDSEC") + g(0, "EOF");
}

export function toGeoJSON(calls: Call[], r: Closure): string {
  const ring = outline(calls, r).map((p) => [+p.x.toFixed(4), +p.y.toFixed(4)]);
  if (!r.closed) ring.push(ring[0]);
  return JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { crs: "local, US survey feet, POB = 0,0", closed: r.closed, misclosure_ft: +r.misclosure.toFixed(3), area_sqft: Math.round(r.areaSqFt), acres: +r.acres.toFixed(4) }, geometry: { type: "Polygon", coordinates: [ring] } }] }, null, 2);
}

export function download(name: string, mime: string, body: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: mime }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
