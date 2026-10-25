"""Compact line format the model emits (about 3x fewer tokens than JSON), and its conversion to the JSON schema."""
from __future__ import annotations

import re

from .geo import FEET_PER, Call

# Unit names the model may write; all map to the canonical unit. A model that reads "varas" correctly should not fail on spelling.
ALIAS = {"ft": "ft", "feet": "ft", "foot": "ft", "chain": "chain", "chains": "chain", "pole": "pole", "poles": "pole", "rod": "pole", "rods": "pole", "perch": "pole", "perches": "pole",
         "vara": "vara", "varas": "vara", "link": "link", "links": "link", "m": "m", "meter": "m", "meters": "m", "metre": "m", "metres": "m"}
UNITS = "|".join(sorted(ALIAS, key=len, reverse=True))


def num(x: float) -> str:
    return f"{x:.4f}".rstrip("0").rstrip(".")


def encode(pob: str, calls: list[Call]) -> str:
    lines = [f"POB {pob}"]
    for c in calls:
        b = f"{c.ns} {c.deg} {c.min} {c.sec} {c.ew}"
        if c.type == "curve":
            lines.append(f"C {b} {num(c.dist)} {c.unit} R {num(c.radius)} {c.radius_unit} {c.turn} | {c.ref}")
        else:
            lines.append(f"L {b} {num(c.dist)} {c.unit} | {c.ref}")
    return "\n".join(lines)


_B = r"([NS]) (\d{1,2}) (\d{1,2}) (\d{1,2}) ([EW])"
_LINE = re.compile(rf"^L {_B} (\d+(?:\.\d+)?) ({UNITS}) \| ?(.*)$")
_CURVE = re.compile(rf"^C {_B} (\d+(?:\.\d+)?) ({UNITS}) R (\d+(?:\.\d+)?) ({UNITS}) ([LR]) \| ?(.*)$")


def decode(text: str):
    """-> (pob, calls, errors). Never raises: unparseable lines become errors so the caller can flag the output."""
    pob, calls, errors = "", [], []
    for raw in text.strip().splitlines():
        line = raw.strip()
        if not line: continue
        if line.startswith("POB"):
            pob = line[3:].strip(); continue
        if (m := _LINE.match(line)):
            g = m.groups()
            calls.append(Call("line", g[0], int(g[1]), int(g[2]), int(g[3]), g[4], float(g[5]), ALIAS[g[6]], g[7].strip()))
        elif (m := _CURVE.match(line)):
            g = m.groups()
            calls.append(Call("curve", g[0], int(g[1]), int(g[2]), int(g[3]), g[4], float(g[5]), ALIAS[g[6]], g[10].strip(), float(g[7]), ALIAS[g[8]], g[9]))
        else:
            errors.append(f"unparseable line: {line[:60]!r}")
    for c in calls:
        if c.deg > 90 or c.min > 59 or c.sec > 59 or (c.deg == 90 and (c.min or c.sec)):
            errors.append(f"impossible bearing: {c.ns} {c.deg} {c.min} {c.sec} {c.ew}")
    if not calls: errors.append("no calls found")
    return pob, calls, errors


def to_json(pob: str, calls: list[Call]) -> dict:
    out = []
    for i, c in enumerate(calls, 1):
        d = {"n": i, "type": c.type, "bearing": {"quadrant": f"{c.ns}{c.ew}", "deg": c.deg, "min": c.min, "sec": c.sec},
             "distance": c.dist, "unit": c.unit, "reference": c.ref or None}
        if c.type == "curve": d["curve"] = {"radius": c.radius, "radius_unit": c.radius_unit, "direction": c.turn}
        out.append(d)
    return {"point_of_beginning": pob, "calls": out}
