/** TypeScript port of deedreader/validate.py + words.py, so the UI shows the same checks the Python pipeline runs. */
import { closure, findFixes, fmtRatio, toFeet } from "./survey.ts";
import type { Call, Check } from "./types";

const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const W2N: Record<string, number> = { ...Object.fromEntries(ONES.map((w, i) => [w, i])), ...TENS };
const NUMWORD = "(?:" + [...ONES, ...Object.keys(TENS), "hundred", "thousand"].join("|") + ")";
const PHRASE = new RegExp(`\\b${NUMWORD}(?:[\\s-]+(?:and[\\s-]+)?${NUMWORD})*\\b`, "gi");

function wordsToInt(s: string): number | null {
  let total = 0, cur = 0, seen = false;
  for (const tok of s.toLowerCase().trim().split(/[\s-]+/)) {
    if (tok in W2N) { cur += W2N[tok]; seen = true; }
    else if (tok === "hundred") { cur = Math.max(cur, 1) * 100; seen = true; }
    else if (tok === "thousand") { total += Math.max(cur, 1) * 1000; cur = 0; seen = true; }
    else if (tok === "and" || tok === "") continue;
    else return null;
  }
  return seen ? total + cur : null;
}

export function numbersIn(text: string): Set<number> {
  const vals = new Set<number>();
  const t = text.replace(/,/g, "");
  for (const m of t.matchAll(/(\d+)\s+(\d+)\/(\d+)/g)) vals.add(+m[1] + +m[2] / +m[3]);
  for (const m of t.matchAll(/(\d+)\s*chains?\s*(?:and\s*)?(\d+)\s*links?/gi)) vals.add(+m[1] + +m[2] / 100);
  for (const m of t.matchAll(/(\d+)\s*links?\b/gi)) vals.add(+m[1] / 100);
  for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) vals.add(parseFloat(m[0]));
  for (const m of t.matchAll(PHRASE)) {
    const p = m[0].toLowerCase(), after = t.slice(m.index! + m[0].length);
    if (/^\s+tenths?\b/i.test(after) && p.includes(" and ")) {
      const i = p.lastIndexOf(" and "), w = wordsToInt(p.slice(0, i)), f = wordsToInt(p.slice(i + 5));
      if (w !== null && f !== null) vals.add(w + f / 10);
    }
    const w = wordsToInt(p);
    if (w !== null) vals.add(w);
  }
  return vals;
}

const SPLIT = /[;,]?\s*\b(?:(?:running|thence|then)\b\s*)+|;/gi;
export type Clause = { text: string; start: number; end: number };

/** Clause i+1 belongs to call i (clause 0 is the point of beginning). null when the clause count does not line up. */
export function clauses(text: string, nCalls: number): Clause[] | null {
  const out: Clause[] = [];
  let last = 0;
  for (const m of text.matchAll(SPLIT)) {
    out.push({ text: text.slice(last, m.index), start: last, end: m.index! });
    last = m.index! + m[0].length;
  }
  out.push({ text: text.slice(last), start: last, end: text.length });
  const parts = out.filter((c) => c.text.trim());
  return parts.length === nCalls + 1 ? parts : null;
}

const REF_KEYS: Record<string, RegExp> = {
  "iron pin": /iron|rebar|\bpin\b|\brod\b|pipe/i, stone: /stone/i, "concrete monument": /monument|concrete/i, "white oak": /white\s*oak/i, "red oak": /red\s*oak/i,
  hickory: /hickory/i, post: /post/i, stake: /stake/i, creek: /creek|\brun\b|branch|stream/i, road: /road|street|avenue|highway|lane/i, pob: /beginning|\bpob\b|origin/i, point: /point/i,
};

/** Map free text like "a granite stone" to the canonical monument type used by the model. */
export function canonRef(text: string | null): string | null {
  if (!text) return null;
  for (const k of ["white oak", "red oak", "hickory", "iron pin", "concrete monument", "stone", "post", "stake", "creek", "road", "pob"]) if (REF_KEYS[k].test(text)) return k;
  return text;
}

const near = (vals: Set<number>, x: number) => [...vals].some((v) => Math.abs(v - x) < 1e-6);

export function provenance(text: string, calls: Call[]): string[] {
  const segs = clauses(text, calls.length), whole = numbersIn(text), bad: string[] = [];
  calls.forEach((c, k) => {
    const seg = segs ? segs[k + 1].text : text, vals = segs ? numbersIn(seg) : whole;
    const due = /\bdue\b/i.test(seg), zero = /zero/i.test(seg);
    const nums: [string, number | undefined][] = [["degrees", c.deg], ["distance", c.dist], ["radius", c.radius]];
    for (const [name, x] of nums) {
      if (x === undefined || (name === "degrees" && due && (x === 0 || x === 90)) || (name === "degrees" && x === 0 && zero)) continue;
      if (!near(vals, x)) bad.push(`call ${k + 1}: ${name} ${x} is not in its clause of the source text`);
    }
    for (const [name, x] of [["minutes", c.min], ["seconds", c.sec]] as const) if (x && !near(vals, x)) bad.push(`call ${k + 1}: ${name} ${x} is not in its clause of the source text`);
  });
  return bad;
}

export function refGrounding(text: string, calls: Call[]): string[] {
  const segs = clauses(text, calls.length), bad: string[] = [];
  calls.forEach((c, k) => {
    const key = c.ref ? REF_KEYS[c.ref] : undefined;
    if (!key) bad.push(`call ${k + 1}: reference "${c.ref ?? ""}" is not a known monument type`);
    else if (!key.test(segs ? segs[k + 1].text : text)) bad.push(`call ${k + 1}: reference "${c.ref}" is not in its clause of the source text`);
  });
  return bad;
}


// ---- independent deterministic reader (mirror of crosscheck() in deedreader/validate.py) ----
const SYM = "[°º*o]";
const BEARINGS = [
  /\b([NS])\s*(\d{1,2})-(\d{1,2})-(\d{1,2})\s*([EW])\b/,
  new RegExp(`\\b([NS])\\.?\\s*(\\d{1,2})\\s*${SYM}\\s*(?:(\\d{1,2})\\s*['’\`]\\s*)?(?:(\\d{1,2})\\s*(?:"|''|”)\\s*)?([EW])\\b\\.?`),
  /\b(north|south)\s+(\d{1,2})\s+degrees?(?:\s+(\d{1,2})\s+minutes?)?(?:\s+(\d{1,2})\s+seconds?)?\s+(east|west)\b/i,
];
const DIST = /(\d[\d,]*(?:\.\d+)?)\s*(?:(chains?)\s*(?:and\s*(\d+)\s*links?)?|(feet|foot|ft\.?|')|(poles?|rods?|perch(?:es)?)|(varas?)|(links?)|(meters?|metres?))/i;

export function crosscheck(text: string, calls: Call[]): string[] {
  const segs = clauses(text, calls.length);
  if (!segs) return [];
  const bad: string[] = [];
  calls.forEach((c, k) => {
    const n = k + 1, seg = segs[n].text, low = seg.toLowerCase();
    const curveText = /\b(curve|arc)\b/.test(low);
    if (curveText !== (c.type === "curve")) { bad.push(`call ${n}: the deed says ${curveText ? "a curve" : "a straight line"} but the model wrote a ${c.type}`); return; }
    if (c.type === "curve") {
      const side = /to the (left|right)\b/.exec(low);
      if (side && side[1][0].toUpperCase() !== c.turn) bad.push(`call ${n}: the deed says the curve turns ${side[1]} but the model wrote ${c.turn}`);
    }
    let b: [string, number, number, number, string] | null = null, rest = seg;
    for (const rx of BEARINGS) {
      const m = rx.exec(seg);
      if (m) { b = [m[1][0].toUpperCase(), +m[2], +(m[3] ?? 0), +(m[4] ?? 0), m[5][0].toUpperCase()]; rest = seg.slice(m.index + m[0].length); break; }
    }
    if (!b) return;
    if (b.join() !== [c.ns, c.deg, c.min, c.sec, c.ew].join()) bad.push(`call ${n}: an independent reading of the clause gives ${b.join(" ")}, the model wrote ${c.ns} ${c.deg} ${c.min} ${c.sec} ${c.ew}`);
    if (c.type === "line") {
      const m = DIST.exec(rest);
      if (m) {
        let val = parseFloat(m[1].replace(/,/g, "")), unit: "chain" | "ft" | "pole" | "vara" | "link" | "m";
        if (m[2]) { unit = "chain"; if (m[3]) val += +m[3] / 100; } else if (m[4]) unit = "ft"; else if (m[5]) unit = "pole"; else if (m[6]) unit = "vara"; else if (m[7]) unit = "link"; else unit = "m";
        const want = toFeet(c.dist, c.unit);
        if (Math.abs(toFeet(val, unit) - want) > 0.01 + 1e-5 * want) bad.push(`call ${n}: an independent reading gives ${val} ${unit}, the model wrote ${c.dist} ${c.unit}`);
      }
    }
  });
  return bad;
}

export const MIN_LOGPROB_FLOOR = -1.5;

/** The full checklist, same order as deedreader/validate.py. Any failed check means NEEDS HUMAN REVIEW. */
export function runChecks(source: string, calls: Call[], parseErrors: string[] = [], minLogprob?: number | null): Check[] {
  const r = calls.length ? closure(calls) : null;
  const prov = calls.length ? provenance(source, calls) : [], refs = calls.length ? refGrounding(source, calls) : [], cross = calls.length ? crosscheck(source, calls) : [];
  const out: Check[] = [
    { id: "parse", label: "Output is well-formed", ok: parseErrors.length === 0, detail: parseErrors },
    { id: "closure", label: "Parcel closes", ok: !!r?.closed, detail: r && !r.closed ? [`misclosure ${r.misclosure.toFixed(2)} ft, ${fmtRatio(r.ratio)}`, ...findFixes(calls, 1).map((f) => `a single change closes it: call ${f.callId}, ${f.label}`)] : [] },
    { id: "numbers", label: "Every number is in its clause of the deed", ok: prov.length === 0, detail: prov },
    { id: "refs", label: "Every monument is in its clause of the deed", ok: refs.length === 0, detail: refs },
    { id: "cross", label: "An independent reader agrees on bearings, distances and curves", ok: cross.length === 0, detail: cross },
  ];
  if (minLogprob !== undefined && minLogprob !== null) out.push({ id: "conf", label: "Model was confident on every number", ok: minLogprob >= MIN_LOGPROB_FLOOR, detail: minLogprob < MIN_LOGPROB_FLOOR ? [`least-confident number token: logprob ${minLogprob.toFixed(2)}`] : [] });
  return out;
}
