"""Everything that decides whether an output may be returned as confident. A failed check means NEEDS HUMAN REVIEW."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .fmt import ALIAS, decode
from .geo import Call, Closure, closure, find_fixes, to_feet
from .words import numbers_in

LOGPROB_FLOOR = -1.5  # a number token the model was this unsure about gets a human look. Chosen a priori, not tuned; eval/report.py sweeps it


@dataclass
class Verdict:
    pob: str
    calls: list[Call]
    closure: Closure | None
    flags: list[str] = field(default_factory=list)
    fixes: list = field(default_factory=list)

    @property
    def needs_review(self) -> bool: return bool(self.flags)


def _near(vals: set[float], x: float) -> bool:
    return any(abs(v - x) < 1e-6 for v in vals)


_SPLIT = re.compile(r"[;,]?\s*\b(?:(?:running|thence|then)\b\s*)+|;", re.I)  # a call boundary: ";" and/or "thence", "running thence", ...
REF_KEYS = {
    "iron pin": r"iron|rebar|\bpin\b|\brod\b|pipe", "stone": r"stone", "concrete monument": r"monument|concrete", "white oak": r"white\s*oak",
    "red oak": r"red\s*oak", "hickory": r"hickory", "post": r"post", "stake": r"stake", "creek": r"creek|\brun\b|branch|stream",
    "road": r"road|street|avenue|highway|lane", "pob": r"beginning|\bpob\b|origin", "point": r"point",
}


def segments(text: str, n_calls: int) -> list[str] | None:
    """Clause i+1 of the description belongs to call i (clause 0 is the point of beginning). None if the clause count does not line up."""
    parts = [p for p in _SPLIT.split(text) if p.strip()]
    return parts if len(parts) == n_calls + 1 else None  # OCR can eat a 'thence'; then fall back to whole-text checks instead of mis-aligning


def provenance(text: str, calls: list[Call]) -> list[str]:
    """Every number the model emitted must be readable in the source text, in that call's own clause when clauses line up.
    Catches hallucinated or misplaced digits that closure cannot."""
    segs = segments(text, len(calls))
    whole = numbers_in(text)
    due = "due" in text.lower()  # "due north" carries a bearing of 0 or 90 with no numeral
    bad = []
    for i, c in enumerate(calls, 1):
        vals = numbers_in(segs[i]) if segs else whole
        dz = due if not segs else "due" in segs[i].lower()
        zero = "zero" in (segs[i] if segs else text).lower()
        for name, x in (("degrees", c.deg), ("distance", c.dist), ("radius", c.radius)):
            if x is None or (name == "degrees" and dz and x in (0, 90)) or (name == "degrees" and x == 0 and zero): continue
            if not _near(vals, float(x)): bad.append(f"call {i}: {name} {x:g} is not in its clause of the source text")
        for name, x in (("minutes", c.min), ("seconds", c.sec)):  # zero minutes/seconds are usually omitted in prose
            if x and not _near(vals, float(x)): bad.append(f"call {i}: {name} {x} is not in its clause of the source text")
    return bad


# ---- independent deterministic reader -------------------------------------------------------------------------------
# For the common numeric bearing formats, read the clause with regexes and compare with the model. Agreement is strong evidence; disagreement
# is a flag; a clause the regexes cannot read gets no opinion (spelled-out numbers, unusual phrasing). This catches errors closure cannot:
# a dropped arc-minute, a flipped curve direction, a swapped monument-free digit.
_SYM = r"[°º*o]"
_BEARINGS = [
    re.compile(r"\b([NS])\s*(\d{1,2})-(\d{1,2})-(\d{1,2})\s*([EW])\b"),
    re.compile(rf"\b([NS])\.?\s*(\d{{1,2}})\s*{_SYM}\s*(?:(\d{{1,2}})\s*['’`]\s*)?(?:(\d{{1,2}})\s*(?:\"|''|”)\s*)?([EW])\b\.?"),
    re.compile(r"\b(north|south)\s+(\d{1,2})\s+degrees?(?:\s+(\d{1,2})\s+minutes?)?(?:\s+(\d{1,2})\s+seconds?)?\s+(east|west)\b", re.I),
]
_DIST = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*(?:(chains?)\s*(?:and\s*(\d+)\s*links?)?|(feet|foot|ft\.?|')|(poles?|rods?|perch(?:es)?)|(varas?)|(links?)|(meters?|metres?))", re.I)


def _read_clause(seg: str):
    for rx in _BEARINGS:
        m = rx.search(seg)
        if m:
            ns, d, mi, se, ew = m.groups()
            return (ns[0].upper(), int(d), int(mi or 0), int(se or 0), ew[0].upper()), seg[m.end():]
    return None, seg


def crosscheck(text: str, calls: list[Call]) -> list[str]:
    segs = segments(text, len(calls))
    if not segs: return []  # clause alignment unavailable: no opinion
    bad = []
    for i, c in enumerate(calls, 1):
        seg = segs[i]
        low = seg.lower()
        is_curve_text = bool(re.search(r"\b(curve|arc)\b", low))
        if is_curve_text != (c.type == "curve"): bad.append(f"call {i}: the deed says {'a curve' if is_curve_text else 'a straight line'} but the model wrote a {c.type}"); continue
        if c.type == "curve":
            side = re.search(r"to the (left|right)\b", low)
            if side and side[1][0].upper() != c.turn: bad.append(f"call {i}: the deed says the curve turns {side[1]} but the model wrote {c.turn}")
        # bearing: for a curve the clause holds exactly one bearing (the chord); a line holds one too
        b, rest = _read_clause(seg)
        if b is None: continue
        if b != (c.ns, c.deg, c.min, c.sec, c.ew): bad.append(f"call {i}: an independent reading of the clause gives {b[0]} {b[1]} {b[2]} {b[3]} {b[4]}, the model wrote {c.ns} {c.deg} {c.min} {c.sec} {c.ew}")
        if c.type == "line":
            m = _DIST.search(rest)
            if m:
                val = float(m[1].replace(",", ""))
                if m[2]: unit = "chain"; val += int(m[3]) / 100 if m[3] else 0
                elif m[4]: unit = "ft"
                elif m[5]: unit = "pole"
                elif m[6]: unit = "vara"
                elif m[7]: unit = "link"
                else: unit = "m"
                # compare physical length: "88 links" and "0.88 chains" are the same call
                if abs(to_feet(val, unit) - to_feet(c.dist, c.unit)) > 0.01 + 1e-5 * to_feet(c.dist, c.unit): bad.append(f"call {i}: an independent reading gives {val:g} {unit}, the model wrote {c.dist:g} {c.unit}")
    return bad


def ref_grounding(text: str, calls: list[Call]) -> list[str]:
    """A call's reference label must be backed by words in its own clause (e.g. 'stake' needs 'stake' there)."""
    segs = segments(text, len(calls))
    bad = []
    for i, c in enumerate(calls, 1):
        key = REF_KEYS.get(c.ref)
        if key is None: bad.append(f"call {i}: reference {c.ref!r} is not a known monument type"); continue
        if not re.search(key, segs[i] if segs else text, re.I): bad.append(f"call {i}: reference {c.ref!r} is not in its clause of the source text")
    return bad


def check(source: str, model_output: str, min_token_logprob: float | None = None) -> Verdict:
    # Checks, in order: parse -> closure (+ single-field fixes) -> per-clause number provenance -> per-clause reference grounding -> model confidence.
    pob, calls, errors = decode(model_output)
    flags = list(errors)
    cl = closure(calls) if calls else None
    fixes = []
    if cl and not cl.closed:
        flags.append(f"does not close: misclosure {cl.misclosure:.2f} ft, 1:{cl.ratio:,.0f}")
        fixes = find_fixes(calls)
    flags += provenance(source, calls)
    flags += ref_grounding(source, calls)
    flags += crosscheck(source, calls)
    if min_token_logprob is not None and min_token_logprob < LOGPROB_FLOOR:
        flags.append(f"low model confidence (min token logprob {min_token_logprob:.2f})")
    return Verdict(pob, calls, cl, flags, fixes)
