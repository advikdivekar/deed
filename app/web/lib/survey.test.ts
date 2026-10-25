import test from "node:test";
import assert from "node:assert/strict";
import { azimuthDeg, closure, findFixes, toFeet, fmtRatio } from "./survey.ts";
import { runChecks } from "./ground.ts";
import { SAMPLES } from "./samples.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const c = (ns: "N" | "S", deg: number, min: number, ew: "E" | "W", dist: number, unit: "ft" = "ft", id = 0) => ({ id, type: "line" as const, ns, deg, min, sec: 0, ew, dist, unit, ref: null });

test("quadrant bearings convert to azimuth", () => {
  near(azimuthDeg(c("N", 42, 15, "E", 1)), 42.25);
  near(azimuthDeg(c("S", 30, 0, "E", 1)), 150);
  near(azimuthDeg(c("S", 30, 0, "W", 1)), 210);
  near(azimuthDeg(c("N", 30, 0, "W", 1)), 330);
  near(azimuthDeg(c("N", 0, 0, "E", 1)), 0);
  near(azimuthDeg(c("S", 90, 0, "E", 1)), 90);
});

test("unit conversion", () => {
  near(toFeet(1, "chain"), 66);
  near(toFeet(1, "pole"), 16.5);
  near(toFeet(100, "link"), 66);
  near(toFeet(36, "vara"), 100);
  near(toFeet(1, "m"), 3.280833, 1e-5);
});

test("100 x 200 rectangle closes exactly, area is 20,000 sq ft", () => {
  const r = closure([c("N", 0, 0, "E", 200, "ft", 0), c("S", 90, 0, "E", 100, "ft", 1), c("S", 0, 0, "E", 200, "ft", 2), c("N", 90, 0, "W", 100, "ft", 3)]);
  near(r.misclosure, 0, 1e-9);
  assert.equal(r.ratio, Infinity);
  near(r.areaSqFt, 20_000, 1e-6);
  near(r.acres, 20_000 / 43_560, 1e-9);
  near(r.perimeter, 600);
  assert.ok(r.closed);
});

test("an open traverse reports misclosure distance and ratio", () => {
  const r = closure([c("N", 0, 0, "E", 200, "ft", 0), c("S", 90, 0, "E", 100, "ft", 1), c("S", 0, 0, "E", 190, "ft", 2), c("N", 90, 0, "W", 100, "ft", 3)]);
  near(r.misclosure, 10);
  near(r.ratio, 590 / 10);
  assert.ok(!r.closed);
  assert.equal(fmtRatio(r.ratio), "1:59");
});

test("sample deeds: the good ones close, the broken one is flagged and the fix is found", () => {
  for (const s of SAMPLES) {
    const r = closure(s.deed.calls);
    assert.equal(r.closed, s.expectClosed, s.id);
    if (!s.expectClosed) {
      const fixes = findFixes(s.deed.calls);
      assert.ok(fixes.length > 0, "a fix exists");
      assert.equal(fixes[0].callId, s.brokenCallId);
    }
  }
});

import { demoRead } from "./parse.ts";
test("demo reader recovers every call of every sample deed", () => {
  for (const s of SAMPLES) {
    const got = demoRead(s.text).calls.map(({ ns, deg, min, sec, ew, dist, unit }) => ({ ns, deg, min, sec, ew, dist, unit }));
    const want = s.deed.calls.map(({ ns, deg, min, sec, ew, dist, unit }) => ({ ns, deg, min, sec, ew, dist, unit }));
    assert.deepEqual(got, want, s.id);
  }
});

import { readFileSync } from "node:fs";
import { decodeCompact } from "./compact.ts";
test("TypeScript validator agrees with the Python validator, check by check", () => {
  const cases = JSON.parse(readFileSync(new URL("./parity.json", import.meta.url), "utf8"));
  let bad = 0;
  for (const c of cases) {
    const d = decodeCompact(c.output);
    const ch = Object.fromEntries(runChecks(c.text, d.calls, d.errors).map((x) => [x.id, x.ok]));
    const got = [ch.parse, d.calls.length ? ch.closure : false, d.calls.length ? ch.numbers : true, d.calls.length ? ch.refs : true, d.calls.length ? ch.cross : true];
    const want = [c.parse_ok, c.closes, c.numbers_ok, c.refs_ok, c.cross_ok];
    if (got.join() !== want.join()) { bad++; if (bad <= 3) console.log("MISMATCH", got, want, c.text.slice(0, 120)); }
  }
  assert.equal(bad, 0, `${bad}/${cases.length} cases disagree`);
});
