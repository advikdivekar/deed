"""Synthetic metes-and-bounds generator. Ground truth first (closed polygon with known calls), prose second.

Splits: train/val/test_id use styles 1-6; test_heldout_style uses 'spelled' (every number in words, never seen in
training); test_heldout_unit uses varas (a unit system never seen in training).
"""
from __future__ import annotations

import argparse, json, math, random, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from deedreader.fmt import encode, num
from deedreader.geo import FEET_PER, Call, az_to_bearing, azimuth, closure, to_feet
from deedreader.words import int_to_words, num_to_words

TRAIN_STYLES = ["modern_sym", "modern_dash", "modern_words", "archaic_abbr", "archaic_chains", "ocr"]
HELDOUT_STYLE, HELDOUT_UNIT = "spelled", "varas"

MON = {
    "iron pin": ["an iron pin", "a 1/2 inch iron pin", "an iron rod found", "a 5/8 inch iron pin set", "an iron pin found"],
    "stone": ["a stone", "a marked stone", "a stone in the ground", "a granite stone"],
    "concrete monument": ["a concrete monument", "a concrete monument found", "a 4 inch concrete monument"],
    "white oak": ["a white oak", "a white oak tree", "a 24 inch white oak"],
    "red oak": ["a red oak", "a red oak tree"],
    "hickory": ["a hickory", "a hickory sapling", "a hickory tree"],
    "post": ["a fence post", "a cedar post", "a corner post"],
    "stake": ["a stake", "a wooden stake", "a stake set"],
    "creek": ["a point in the creek", "the center of the creek", "a point in the run"],
    "road": ["a point in the center of the road", "a point in the centerline of County Road 12"],
}
ARCHAIC_MON = ["stone", "white oak", "red oak", "hickory", "post", "stake", "creek"]
LOCATIONS = [
    "at the northwest corner of Lot 14, Block 3 of Maple Ridge Subdivision", "on the east line of Elm Street", "at the southeast corner of the Henderson tract",
    "at the intersection of the south line of Oak Avenue and the west line of Pine Street", "in the north line of the Brewer survey, corner to Hartley",
    "on the north bank of the run", "at the corner of Tract 7 as shown on the plat recorded in Plat Book 12, Page 88", "at the southwest corner of the Smith lot",
]
THENCE = ["thence", "thence", "thence", "then", "running thence", "thence running"]
DISTRACT = [
    "LESS AND EXCEPT that portion conveyed to the County for road right-of-way, 20 feet in width along the east line.",
    "SUBJECT TO an easement 15 feet wide for public utilities along the south line, recorded in Deed Book 482, Page 17.",
    "Being the same property conveyed in Deed Book 1203, Page 455.", "Tax Parcel No. 12-345-6789.",
    "SUBJECT TO restrictive covenants of record and to the rights of others in and to the creek.", "Together with a 30 foot ingress and egress easement.",
]
ALL_MON = {k: v for k, v in MON.items()}


def style_cfg(style: str) -> dict:
    return {
        "modern_sym":   dict(units=["ft"] * 9 + ["m"], sec=True,  dd=2, curves=True,  arch=False),
        "modern_dash":  dict(units=["ft"],             sec=True,  dd=2, curves=True,  arch=False),
        "modern_words": dict(units=["ft"],             sec=True,  dd=2, curves=True,  arch=False),
        "archaic_abbr": dict(units=["ft", "ft", "pole", "chain", "link"], sec=False, dd=1, curves=False, arch=True),
        "archaic_chains": dict(units=["chain", "chain", "pole"],         sec=False, dd=2, curves=False, arch=True),
        "ocr":          dict(units=["ft"] * 8 + ["pole", "chain"],        sec=False, dd=1, curves=False, arch=True),
        "spelled":      dict(units=["ft"],  sec=False, dd=1, curves=False, arch=True),
        "varas":        dict(units=["vara"],              sec=False, dd=1, curves=False, arch=True),
    }[style]


DD = {"ft": 1, "m": 2, "chain": 2, "pole": 2, "vara": 1, "link": 0}


def quant(x: float, dd: int) -> float:
    return round(x, dd)


def make_polygon(rng: random.Random, n: int, perimeter_ft: float):
    angs = sorted(rng.uniform(0, 2 * math.pi) for _ in range(n))
    while any((angs[(i + 1) % n] - angs[i]) % (2 * math.pi) > 2.6 or (angs[(i + 1) % n] - angs[i]) % (2 * math.pi) < 0.12 for i in range(n)):
        angs = sorted(rng.uniform(0, 2 * math.pi) for _ in range(n))
    r = [rng.uniform(0.55, 1.0) for _ in range(n)]
    pts = [(r[i] * math.cos(angs[i]), r[i] * math.sin(angs[i])) for i in range(n)]
    per = sum(math.dist(pts[i], pts[(i + 1) % n]) for i in range(n))
    k = perimeter_ft / per
    pts = [(x * k, y * k) for x, y in pts]
    if rng.random() < 0.5: pts.reverse()
    s = rng.randrange(n)
    return pts[s:] + pts[:s]


def build_truth(rng: random.Random, style: str):
    cfg = style_cfg(style)
    for _ in range(1500):
        n = rng.choices(range(3, 13), weights=[2, 8, 9, 8, 6, 4, 3, 2, 1, 1])[0]
        pts = make_polygon(rng, n, rng.uniform(900, 6000))
        unit_main = rng.choice(cfg["units"])
        mixed = rng.random() < 0.08 and style not in ("varas", "spelled")
        sec = cfg["sec"]
        x, y = pts[0]
        calls = []
        targets = pts[1:] + [pts[0]]
        for i, (tx, ty) in enumerate(targets):
            dx, dy = tx - x, ty - y
            az = math.degrees(math.atan2(dx, dy)) % 360
            ns, d, m, s, ew = az_to_bearing(az)
            if not sec:
                total = round(az * 60) % (360 * 60)  # whole minutes
                ns, d, m, s, ew = az_to_bearing(total / 60)
            unit = unit_main if not (mixed and rng.random() < 0.3) else rng.choice(["ft", "pole", "chain"])
            if unit == "link": unit = "link"
            dist_ft = math.hypot(dx, dy)
            dd = DD[unit] if not (unit == "ft" and style.startswith("modern")) else 2
            dist = quant(dist_ft / FEET_PER[unit], dd)
            if unit == "link": dist = float(round(dist))
            if dist <= 0: break
            c = Call("line", ns, d, m, s, ew, dist, unit)
            calls.append(c)
            az_r = math.radians(azimuth(c)); df = to_feet(dist, unit)
            x, y = x + df * math.sin(az_r), y + df * math.cos(az_r)
        else:
            cl = closure(calls)
            if cl.ratio >= 8000 and cl.perimeter > 400 and min(to_feet(c.dist, c.unit) for c in calls) > 12:
                return calls, cl
    raise RuntimeError("could not build a closing parcel")


def add_curves(rng: random.Random, calls: list[Call]):
    out = list(calls)
    for i in rng.sample(range(len(out) - 1), k=min(len(out) - 1, rng.choice([1, 1, 2]))):
        c = out[i]
        chord_ft = to_feet(c.dist, c.unit)
        r_ft = chord_ft * rng.uniform(0.62, 3.5)
        out[i] = Call("curve", c.ns, c.deg, c.min, c.sec, c.ew, c.dist, c.unit, "", round(r_ft / FEET_PER[c.unit], 2), c.unit, rng.choice("LR"))
    return out


def assign_refs(rng: random.Random, calls: list[Call], arch: bool):
    pool = ARCHAIC_MON if arch else list(MON)
    out = []
    for i, c in enumerate(calls):
        ref = "pob" if i == len(calls) - 1 else rng.choice(pool)
        out.append(Call(c.type, c.ns, c.deg, c.min, c.sec, c.ew, c.dist, c.unit, ref, c.radius, c.radius_unit, c.turn))
    return out


# ---------- rendering ----------
def fmt_dist(x: float, unit: str, style: str, rng: random.Random) -> str:
    if style == "spelled":
        whole = int(x); frac = x - whole
        name = {"ft": "feet", "pole": "poles", "chain": "chains", "vara": "varas", "link": "links", "m": "meters"}[unit]
        if abs(frac) < 1e-9: return f"{int_to_words(whole)} {name}"
        return f"{num_to_words(round(x, 1))} {name}"
    if unit == "chain" and style == "archaic_chains" and rng.random() < 0.6:
        ch = int(x + 1e-9); links = round((x - ch) * 100)
        if links == 0: return f"{ch} chains"
        return f"{ch} chains and {links} links" if ch else f"{links} links"
    if unit == "ft":
        if style == "modern_dash": return f"{x:.2f}'"
        if style in ("modern_sym", "modern_words"): return f"{x:.2f} feet"
        return rng.choice([f"{num(x)} feet", f"{num(x)} ft.", f"{num(x)} feet"])
    if unit == "m": return f"{x:.2f} meters"
    if unit == "pole": return f"{num(x)} " + rng.choice(["poles", "poles", "rods", "perches"])
    if unit == "chain": return f"{num(x)} chains"
    if unit == "vara": return f"{num(x)} varas"
    return f"{int(x)} links"


def fmt_bearing(c: Call, style: str, rng: random.Random) -> str:
    ns, d, m, s, ew = c.ns, c.deg, c.min, c.sec, c.ew
    N = {"N": "North", "S": "South", "E": "East", "W": "West"}
    if style == "spelled":
        due = None
        if d == 0 and m == 0: due = "due north" if ns == "N" else "due south"
        if due: return due
        parts = f"{N[ns].lower()} {int_to_words(d)} degrees" + (f" {int_to_words(m)} minutes" if m else "") + f" {N[ew].lower()}"
        return parts
    if style == "modern_sym": return f"{ns} {d}°{m:02d}'{s:02d}\" {ew}"
    if style == "modern_dash": return f"{ns}{d:02d}-{m:02d}-{s:02d}{ew}"
    if style == "modern_words": return f"{N[ns]} {d} degrees {m:02d} minutes {s:02d} seconds {N[ew]}"
    if style == "archaic_chains":
        return f"{N[ns].lower()} {d} degrees" + (f" {m} minutes" if m else "") + f" {N[ew].lower()}"
    # archaic_abbr / ocr / varas
    if d == 0 and m == 0 and rng.random() < 0.7: return "due north" if ns == "N" else "due south"
    if d == 90 and m == 0 and rng.random() < 0.7: return "due east" if ew == "E" else "due west"
    if rng.random() < 0.5: return f"{ns}. {d}°" + (f" {m}'" if m else "") + f" {ew}."
    return f"{ns} {d}°" + (f"{m:02d}'" if m else "") + f" {ew}"


def ref_phrase(ref: str, rng: random.Random, style: str, arch_mon=None) -> str:
    if ref == "pob": return rng.choice(["the point of beginning", "the place of beginning", "the point of beginning"])
    surf = rng.choice(MON[ref])
    if style == "spelled": surf = surf.replace("24 inch", "twenty-four inch").replace("1/2", "one half").replace("5/8", "five eighths").replace("4 inch", "four inch").replace("County Road 12", "County Road Twelve")
    return surf


def render(rng: random.Random, style: str, calls: list[Call], pob_mon: str, cl) -> str:
    sp = style
    first = f"{rng.choice(['Beginning', 'BEGINNING', 'Commencing'])} at {ref_phrase(pob_mon, rng, sp)} {rng.choice(LOCATIONS)}"
    parts = [first]
    for i, c in enumerate(calls):
        th = rng.choice(THENCE)
        if c.type == "curve":
            side = "right" if c.turn == "R" else "left"
            arc = round(2 * to_feet(c.radius, c.radius_unit) * math.asin(min(1, to_feet(c.dist, c.unit) / (2 * to_feet(c.radius, c.radius_unit)))) / FEET_PER[c.unit], 2)
            if sp == "modern_dash":
                body = f"along a curve to the {side} (R={c.radius:.2f}', Arc={arc:.2f}', Chord={fmt_bearing(c, sp, rng)} {c.dist:.2f}')"
            else:
                body = f"along the arc of a curve to the {side}, having a radius of {c.radius:.2f} feet, an arc length of {arc:.2f} feet, a chord bearing of {fmt_bearing(c, sp, rng)} and a chord distance of {fmt_dist(c.dist, c.unit, sp, rng)}"
        else:
            body = f"{fmt_bearing(c, sp, rng)}" + rng.choice([", ", " ", ", a distance of ", " for "] if sp.startswith("modern") else [", ", " ", " for "]) + fmt_dist(c.dist, c.unit, sp, rng)
        tail = f" {rng.choice(['to', 'to', 'to', 'along to'])} {ref_phrase(c.ref, rng, sp)}"
        if i == len(calls) - 1 and c.ref == "pob": tail = f" to {ref_phrase('pob', rng, sp)}"
        parts.append(f"{th} {body}{tail}")
    text = "; ".join(parts) + "."
    extras = []
    if rng.random() < 0.55: extras.append(f"Containing {cl.acres:.2f} acres, more or less" + ".")
    if rng.random() < 0.5: extras.append(rng.choice(DISTRACT))
    if rng.random() < 0.15: extras.append(rng.choice(DISTRACT))
    if extras: text += " " + " ".join(extras)
    if sp == "spelled": text = text.replace("Containing", "Containing")  # acres stay numeric: distractor only
    return text


def ocr_noise(rng: random.Random, text: str) -> str:
    out = []
    for w in text.split(" "):
        r = rng.random()
        if len(w) > 7 and w.isalpha() and r < 0.04:
            k = rng.randrange(3, len(w) - 2); w = w[:k] + "-\n" + w[k:]
        elif r < 0.07: w = w + "\n"
        elif r < 0.1: w = " " + w
        if w.isalpha() and len(w) > 4 and rng.random() < 0.015:
            k = rng.randrange(1, len(w) - 1); w = w[:k] + {"e": "c", "o": "a", "n": "u", "i": "l", "a": "o"}.get(w[k], w[k]) + w[k + 1:]
        out.append(w)
    t = " ".join(out)
    t = t.replace("°", rng.choice(["°", "°", "°", "*", "o", "º"])).replace("'", rng.choice(["'", "'", "’", "`"]))
    return t


def make_example(rng: random.Random, style: str) -> dict:
    cfg = style_cfg(style)
    calls, cl = build_truth(rng, style)
    if cfg["curves"] and rng.random() < 0.3 and len(calls) >= 4: calls = add_curves(rng, calls)
    calls = assign_refs(rng, calls, cfg["arch"])
    cl = closure(calls)
    pob_mon = rng.choice(ARCHAIC_MON if cfg["arch"] else list(MON))
    text = render(rng, style, calls, pob_mon, cl)
    if style == "ocr": text = ocr_noise(rng, text)
    return {"style": style, "text": text, "completion": encode(pob_mon, calls), "n_calls": len(calls), "curves": sum(c.type == "curve" for c in calls),
            "true_ratio": None if math.isinf(cl.ratio) else round(cl.ratio), "acres": round(cl.acres, 4)}


PROMPT = "Extract the property boundary calls from this legal description.\n\n{text}\n\n###\n"
END = "\nEND"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", type=int, default=2000); ap.add_argument("--val", type=int, default=200)
    ap.add_argument("--test", type=int, default=500); ap.add_argument("--heldout", type=int, default=250)
    ap.add_argument("--seed", type=int, default=7); ap.add_argument("--out", default="data/out")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    plan = {"train": (a.train, TRAIN_STYLES), "val": (a.val, TRAIN_STYLES), "test_id": (a.test, TRAIN_STYLES),
            "test_heldout_style": (a.heldout, [HELDOUT_STYLE]), "test_heldout_unit": (a.heldout, [HELDOUT_UNIT])}
    for si, (name, (n, styles)) in enumerate(plan.items()):
        rng = random.Random(a.seed * 1000 + si)  # independent stream per split: no leakage by construction
        seen = set()
        with open(out / f"{name}.jsonl", "w") as f:
            i = 0
            while i < n:
                ex = make_example(rng, styles[i % len(styles)])
                if ex["text"] in seen: continue
                seen.add(ex["text"]); ex["id"] = f"{name}-{i:05d}"; ex["split"] = name
                f.write(json.dumps(ex) + "\n"); i += 1
        print(f"{name}: {n}")


if __name__ == "__main__":
    main()
