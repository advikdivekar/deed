"""Plain-code survey math. The model never does any of this."""
from __future__ import annotations

import math
from dataclasses import dataclass, field, replace
from typing import Optional

# US survey conventions. Vara is the Texas vara (33 1/3 in).
FEET_PER = {"ft": 1.0, "chain": 66.0, "pole": 16.5, "vara": 100.0 / 36.0, "link": 0.66, "m": 1.0 / 0.3048006096}
CLOSE_RATIO = 5_000  # "closes" at 1:5,000 or better (common rural boundary standard); override per jurisdiction


@dataclass(frozen=True)
class Call:
    type: str  # "line" | "curve"
    ns: str
    deg: int
    min: int
    sec: int
    ew: str
    dist: float  # line length, or curve chord length
    unit: str
    ref: str = ""
    radius: Optional[float] = None  # curves only
    radius_unit: Optional[str] = None
    turn: Optional[str] = None  # "L" | "R": which side the radius point (center) lies on, looking along travel

    def bearing_key(self):
        return (self.ns, self.deg, self.min, self.sec, self.ew)


def to_feet(d: float, unit: str) -> float:
    return d * FEET_PER[unit]


def azimuth(c: Call) -> float:
    a = c.deg + c.min / 60 + c.sec / 3600
    if c.ns == "N":
        return a if c.ew == "E" else 360 - a
    return 180 - a if c.ew == "E" else 180 + a


def az_to_bearing(az: float, sec_resolution: bool = True):
    """Azimuth degrees -> (ns, deg, min, sec, ew), rounded to whole seconds."""
    az %= 360
    tot = round(az * 3600) % (360 * 3600)
    az = tot / 3600
    if az <= 90: ns, ew, ang = "N", "E", az
    elif az <= 180: ns, ew, ang = "S", "E", 180 - az
    elif az <= 270: ns, ew, ang = "S", "W", az - 180
    else: ns, ew, ang = "N", "W", 360 - az
    t = round(ang * 3600)
    return ns, t // 3600, (t % 3600) // 60, t % 60, ew


@dataclass
class Closure:
    points: list  # [(x, y)] feet; points[0] = POB, points[-1] = where the last call lands
    misclosure: float
    perimeter: float
    ratio: float
    area_sqft: float
    closed: bool
    @property
    def acres(self): return self.area_sqft / 43560.0


def _seg_area(chord: float, radius: float) -> float:
    s = min(1.0, chord / (2 * radius))
    th = 2 * math.asin(s)
    return radius * radius / 2 * (th - math.sin(th))


def traverse(calls: list[Call]):
    pts = [(0.0, 0.0)]
    per = 0.0
    seg = 0.0  # signed (CCW positive) area added by curve bulges
    for c in calls:
        a = math.radians(azimuth(c))
        d = to_feet(c.dist, c.unit)
        x, y = pts[-1]
        pts.append((x + d * math.sin(a), y + d * math.cos(a)))
        if c.type == "curve" and c.radius:
            r = to_feet(c.radius, c.radius_unit or c.unit)
            if r >= d / 2:
                s = _seg_area(d, r)
                # center on the right of travel => arc bulges left => adds CCW area
                seg += s if c.turn == "R" else -s
                # arc length counts toward perimeter
                per += 2 * r * math.asin(min(1.0, d / (2 * r)))
                continue
        per += d
    return pts, per, seg


def closure(calls: list[Call]) -> Closure:
    pts, per, seg = traverse(calls)
    ex, ey = pts[-1]
    mis = math.hypot(ex, ey)
    ratio = math.inf if mis < 1e-9 else per / mis
    twice = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    area = abs(twice / 2 + seg)
    return Closure(pts, mis, per, ratio, area, len(calls) >= 3 and ratio >= CLOSE_RATIO)


def arc_points(a, b, radius_ft: float, turn: str, n: int = 24):
    """Sample the minor arc from a to b. turn = side the center lies on."""
    (x1, y1), (x2, y2) = a, b
    c = math.hypot(x2 - x1, y2 - y1)
    h = math.sqrt(max(radius_ft**2 - (c / 2) ** 2, 0))
    ux, uy = (x2 - x1) / c, (y2 - y1) / c
    rx, ry = uy, -ux  # right-hand normal of travel
    sgn = 1 if turn == "R" else -1
    cx, cy = (x1 + x2) / 2 + sgn * rx * h, (y1 + y2) / 2 + sgn * ry * h
    a1 = math.atan2(y1 - cy, x1 - cx); a2 = math.atan2(y2 - cy, x2 - cx)
    d = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi  # shortest signed sweep
    return [(cx + radius_ft * math.cos(a1 + d * i / n), cy + radius_ft * math.sin(a1 + d * i / n)) for i in range(n + 1)]


def _swaps(s: str):
    out = set()
    for i in range(len(s) - 1):
        if s[i] != s[i + 1] and "." not in s[i:i + 2]:
            out.add(s[:i] + s[i + 1] + s[i] + s[i + 2:])
    return sorted(out)


@dataclass
class Fix:
    index: int
    label: str
    call: Call
    ratio: float
    misclosure: float


def find_fixes(calls: list[Call], limit: int = 3) -> list[Fix]:
    """Single-field perturbations of every call. Return the ones that make the parcel close, best first."""
    found: list[Fix] = []

    def consider(i: int, label: str, **patch):
        trial = list(calls); trial[i] = replace(calls[i], **patch)
        r = closure(trial)
        if r.closed: found.append(Fix(i, label, trial[i], r.ratio, r.misclosure))

    flip = {"N": "S", "S": "N", "E": "W", "W": "E"}
    for i, c in enumerate(calls):
        consider(i, f"flip {c.ns}->{flip[c.ns]}", ns=flip[c.ns])
        consider(i, f"flip {c.ew}->{flip[c.ew]}", ew=flip[c.ew])
        consider(i, "flip both", ns=flip[c.ns], ew=flip[c.ew])
        for s in _swaps(str(c.deg)):
            if int(s) < 90: consider(i, f"degrees {c.deg}->{int(s)}", deg=int(s))
        for s in _swaps(f"{c.min:02d}"):
            if int(s) < 60: consider(i, f"minutes {c.min}->{int(s)}", min=int(s))
        for s in _swaps(f"{c.dist:g}"):
            try: consider(i, f"distance {c.dist:g}->{float(s):g}", dist=float(s))
            except ValueError: pass
    found.sort(key=lambda f: -f.ratio)
    return found[:limit]
