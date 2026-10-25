import { arcPoints, toFeet } from "./survey.ts";
import type { Call, Closure } from "./types.ts";

export type LatLon = [number, number];
export type Place = { name: string; at: LatLon };

/** Real rural and suburban spots a deed like this could describe. The parcel is fictional; only the place is real. */
export const PLACES: Place[] = [
  { name: "Hill Country, Texas", at: [30.2846, -98.4382] },
  { name: "Shenandoah Valley, Virginia", at: [38.4821, -78.8703] },
  { name: "Central Ohio", at: [40.2316, -83.3619] },
  { name: "Piedmont, North Carolina", at: [35.8122, -79.2187] },
  { name: "Willamette Valley, Oregon", at: [45.0872, -123.0431] },
  { name: "Southern Indiana", at: [38.6731, -86.3144] },
];

export function placeFor(key: string, hint?: "varas" | "poles"): Place {
  if (hint === "varas") return PLACES[0];
  if (hint === "poles") return PLACES[1];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PLACES[h % PLACES.length];
}

const FT_PER_DEG_LAT = 364567;

/** Local feet (x east, y north from the point of beginning) to lat/lon. Fine at parcel scale. */
export function toLatLon(p: { x: number; y: number }, origin: LatLon): LatLon {
  const [lat0, lon0] = origin;
  return [lat0 + p.y / FT_PER_DEG_LAT, lon0 + p.x / (FT_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180))];
}

/** One polyline per call, curves sampled as arcs, in lat/lon. */
export function legsLatLon(calls: Call[], result: Closure, origin: LatLon): LatLon[][] {
  return calls.map((c, i) => {
    const a = result.points[i], b = result.points[i + 1];
    const r = c.type === "curve" && c.radius ? toFeet(c.radius, c.radiusUnit ?? c.unit) : 0;
    const g = r >= toFeet(c.dist, c.unit) / 2 && r > 0 ? arcPoints(a, b, r, c.turn ?? "R") : [a, b];
    return g.map((p) => toLatLon(p, origin));
  });
}
