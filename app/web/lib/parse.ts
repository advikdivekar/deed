import { canonRef } from "./ground.ts";
import type { Call, Deed, Unit } from "./types";

const UNIT_WORDS: [RegExp, Unit][] = [
  [/^(feet|foot|ft)$/i, "ft"], [/^chains?$/i, "chain"], [/^(poles?|rods?|perch(es)?)$/i, "pole"],
  [/^varas?$/i, "vara"], [/^links?$/i, "link"], [/^(meters?|metres?)$/i, "m"],
];

const CALL_RE = /([NS])\s*(\d{1,2})\s*(?:°|º|deg\.?|d)?\s*(?:(\d{1,2})\s*(?:'|′|min\.?|m)\s*)?(?:(\d{1,2})\s*(?:"|″|sec\.?|s)\s*)?([EW])\b[\s,]*(?:for\s+|a\s+distance\s+of\s+)?([\d][\d,]*(?:\.\d+)?)\s*(feet|foot|ft|chains?|poles?|rods?|perch(?:es)?|varas?|links?|meters?|metres?)\b\.?([^;]*?)(?=;|\.\s*$|$)/gi;

/**
 * DEMO ONLY. A regex reader for plain "N 41°00' E 121.9 feet" calls so the studio works on text the replays do not cover.
 * The real reader is the fine-tuned model; this one cannot handle prose, spelled-out numbers, OCR noise or curves.
 */
export function demoRead(text: string): Deed {
  const clean = text.replace(/\s+/g, " ").trim();
  const firstThence = clean.search(/thence/i);
  const pob = (firstThence > 0 ? clean.slice(0, firstThence) : "").replace(/^beginning\s+(at|on|in)\s+/i, "").replace(/[;,\s]+$/, "");
  const calls: Call[] = [];
  for (const m of clean.matchAll(CALL_RE)) {
    const unit = UNIT_WORDS.find(([re]) => re.test(m[7]))?.[1] ?? "ft";
    const ref = canonRef(m[8]?.replace(/^[\s,]*(to|along|thence)\s+/i, "").trim() || null);
    calls.push({ id: calls.length + 1, type: "line", ns: m[1].toUpperCase() as "N" | "S", deg: +m[2], min: m[3] ? +m[3] : 0, sec: m[4] ? +m[4] : 0, ew: m[5].toUpperCase() as "E" | "W", dist: parseFloat(m[6].replace(/,/g, "")), unit, ref });
  }
  return { pob, calls, source: clean };
}
