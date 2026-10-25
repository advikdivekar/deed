export type Unit = "ft" | "chain" | "pole" | "vara" | "link" | "m";

export type Call = {
  id: number;
  type: "line" | "curve";
  ns: "N" | "S";
  deg: number;
  min: number;
  sec: number;
  ew: "E" | "W";
  dist: number; // line length, or curve chord length
  unit: Unit;
  ref: string | null;
  radius?: number; // curves only
  radiusUnit?: Unit;
  turn?: "L" | "R"; // side of travel the radius point lies on
  span?: [number, number]; // character range of this call's clause in the source text
};

export type Deed = { pob: string; calls: Call[]; source?: string };

export type Fix = { callId: number; field: "bearing" | "distance"; label: string; patch: Partial<Call>; ratio: number; misclosure: number };

export type Closure = {
  points: { x: number; y: number }[]; // feet, POB at origin; points[n] is where the last call lands
  misclosure: number;
  ratio: number; // perimeter / misclosure; Infinity when exact
  perimeter: number;
  areaSqFt: number;
  acres: number;
  closed: boolean;
};

export type Check = { id: string; label: string; ok: boolean; detail: string[] };
