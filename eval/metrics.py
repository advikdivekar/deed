"""Field-level accuracy, silent-error rate, flag rate. A flagged-but-wrong output is NOT a silent error."""
from __future__ import annotations

import math
from collections import defaultdict

from deedreader.fmt import decode
from deedreader.geo import azimuth, to_feet
from deedreader.validate import check

FIELDS = ["bearing", "distance", "unit", "reference", "type"]


def _eq_bearing(a, b) -> bool:
    return abs(azimuth(a) - azimuth(b)) < 1e-6 or abs(abs(azimuth(a) - azimuth(b)) - 360) < 1e-6


def compare(truth_text: str, out_text: str):
    tp, tc, _ = decode(truth_text)
    op, oc, errs = decode(out_text)
    res = {f: [] for f in FIELDS}
    for i, t in enumerate(tc):
        o = oc[i] if i < len(oc) else None
        res["bearing"].append(bool(o) and _eq_bearing(t, o))
        res["distance"].append(bool(o) and abs(t.dist - o.dist) < 5e-4)
        res["unit"].append(bool(o) and t.unit == o.unit)
        res["reference"].append(bool(o) and t.ref == o.ref)
        res["type"].append(bool(o) and t.type == o.type and (t.type == "line" or (o.radius is not None and abs((t.radius or 0) - o.radius) < 5e-4 and t.turn == o.turn)))
    exact = len(oc) == len(tc) and tp == op and all(all(v) for v in res.values())
    # physical equivalence: "87 link" and "0.87 chain" are the same call. Reported separately; strict labels stay the headline.
    phys_len = [bool(oc[i:i + 1]) and abs(to_feet(t.dist, t.unit) - to_feet(oc[i].dist, oc[i].unit)) < 0.005 for i, t in enumerate(tc)]
    res["_physical_exact"] = len(oc) == len(tc) and tp == op and all(res[f] and all(res[f]) for f in ("bearing", "reference", "type")) and all(phys_len)
    return res, exact


def wilson_upper(k: int, n: int, z: float = 1.96) -> float:
    if n == 0: return float("nan")
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (c + m) / d


def score(rows: list[dict], lp_floor: float | None = None, use: str = "minlp_num"):
    """rows: dicts with text (source), completion (truth), out (model output), minlp_*. Returns aggregate + per-style."""
    agg = defaultdict(lambda: defaultdict(int))
    for r in rows:
        res, exact = compare(r["completion"], r["out"]); phys = res.pop("_physical_exact")
        lp = r.get(use) if lp_floor is not None else None
        v = check(r["text"], r["out"], min_token_logprob=lp) if lp_floor is None else check_with_floor(r, lp_floor, use)
        flagged = v.needs_review
        for key in ("all", r["style"]):
            a = agg[key]
            a["n"] += 1; a["exact"] += exact; a["flagged"] += flagged
            a["silent"] += (not exact) and (not flagged)
            a["silent_physical"] += (not phys) and (not flagged); a["exact_physical"] += phys
            a["wrong_flagged"] += (not exact) and flagged
            a["right_flagged"] += exact and flagged
            for f in FIELDS: a[f + "_ok"] += sum(res[f]); a[f + "_n"] += len(res[f])
    return {k: dict(v) for k, v in agg.items()}


def check_with_floor(r, floor, use):
    import deedreader.validate as V
    old = V.LOGPROB_FLOOR; V.LOGPROB_FLOOR = floor
    try: return check(r["text"], r["out"], min_token_logprob=r.get(use))
    finally: V.LOGPROB_FLOOR = old


def summarize(agg: dict) -> str:
    lines = ["| group | n | example exact | bearing | distance | unit | reference | flag rate | silent errors (rate, 95% upper) |", "|---|---|---|---|---|---|---|---|---|"]
    for k, a in sorted(agg.items(), key=lambda kv: (kv[0] != "all", kv[0])):
        n = a["n"]
        f = lambda x: f"{100 * a[x + '_ok'] / max(a[x + '_n'], 1):.2f}%"
        lines.append(f"| {k} | {n} | {100 * a['exact'] / n:.1f}% | {f('bearing')} | {f('distance')} | {f('unit')} | {f('reference')} | {100 * a['flagged'] / n:.1f}% | {a['silent']} ({100 * a['silent'] / n:.2f}%, ≤{100 * wilson_upper(a['silent'], n):.2f}%) |")
    return "\n".join(lines)
