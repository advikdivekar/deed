import type { Call, Unit } from "./types";

const ALIAS: Record<string, Unit> = { ft: "ft", feet: "ft", foot: "ft", chain: "chain", chains: "chain", pole: "pole", poles: "pole", rod: "pole", rods: "pole", perch: "pole", perches: "pole", vara: "vara", varas: "vara", link: "link", links: "link", m: "m", meter: "m", meters: "m", metre: "m", metres: "m" };
const UNITS = Object.keys(ALIAS).sort((a, b) => b.length - a.length).join("|");
const B = "([NS]) (\\d{1,2}) (\\d{1,2}) (\\d{1,2}) ([EW])";
const LINE = new RegExp(`^L ${B} (\\d+(?:\\.\\d+)?) (${UNITS}) \\| ?(.*)$`);
const CURVE = new RegExp(`^C ${B} (\\d+(?:\\.\\d+)?) (${UNITS}) R (\\d+(?:\\.\\d+)?) (${UNITS}) ([LR]) \\| ?(.*)$`);

/** Decode the model's compact line format (see deedreader/fmt.py). Never throws; unparseable lines come back as errors. */
export function decodeCompact(text: string): { pob: string; calls: Call[]; errors: string[] } {
  const calls: Call[] = [], errors: string[] = [];
  let pob = "";
  for (const raw of text.trim().split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("POB")) { pob = line.slice(3).trim(); continue; }
    let m = LINE.exec(line);
    if (m) { calls.push({ id: calls.length + 1, type: "line", ns: m[1] as "N", deg: +m[2], min: +m[3], sec: +m[4], ew: m[5] as "E", dist: +m[6], unit: ALIAS[m[7]], ref: m[8].trim() || null }); continue; }
    m = CURVE.exec(line);
    if (m) { calls.push({ id: calls.length + 1, type: "curve", ns: m[1] as "N", deg: +m[2], min: +m[3], sec: +m[4], ew: m[5] as "E", dist: +m[6], unit: ALIAS[m[7]], radius: +m[8], radiusUnit: ALIAS[m[9]], turn: m[10] as "L", ref: m[11].trim() || null }); continue; }
    errors.push(`unparseable line: ${line.slice(0, 60)}`);
  }
  for (const c of calls) if (c.deg > 90 || c.min > 59 || c.sec > 59) errors.push(`impossible bearing: ${c.ns} ${c.deg} ${c.min} ${c.sec} ${c.ew}`);
  if (!calls.length) errors.push("no calls found");
  return { pob, calls, errors };
}
