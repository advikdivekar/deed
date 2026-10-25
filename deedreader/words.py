"""English number words <-> numbers, for spelled-out deed styles and the provenance check."""
from __future__ import annotations
import re

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = {2: "twenty", 3: "thirty", 4: "forty", 5: "fifty", 6: "sixty", 7: "seventy", 8: "eighty", 9: "ninety"}
W2N = {w: i for i, w in enumerate(ONES)} | {w: t * 10 for t, w in TENS.items()}


def int_to_words(n: int) -> str:
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + int_to_words(n % 100))
    return int_to_words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + int_to_words(n % 1000))


def num_to_words(x: float) -> str:
    """121.9 -> 'one hundred twenty-one and nine tenths'. One decimal place at most."""
    whole, tenth = int(x), round((x - int(x)) * 10)
    if tenth == 0: return int_to_words(whole)
    return f"{int_to_words(whole)} and {int_to_words(tenth)} tenth" + ("s" if tenth != 1 else "")


def words_to_int(s: str) -> int | None:
    total = cur = 0
    seen = False
    for tok in re.split(r"[\s-]+", s.lower().strip()):
        if tok in W2N: cur += W2N[tok]; seen = True
        elif tok == "hundred": cur = max(cur, 1) * 100; seen = True
        elif tok == "thousand": total += max(cur, 1) * 1000; cur = 0; seen = True
        elif tok in ("and", ""): continue
        else: return None
    return total + cur if seen else None


_NUMWORD = r"(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)"
_PHRASE = re.compile(rf"\b{_NUMWORD}(?:[\s-]+(?:and[\s-]+)?{_NUMWORD})*\b", re.I)
_TENTHS = re.compile(r"\s+tenths?\b", re.I)


def numbers_in(text: str) -> set[float]:
    """Every numeric value the text can be read as containing: digits, fractions like '118 1/2', and spelled-out words."""
    vals: set[float] = set()
    t = text.replace(",", "")
    for m in re.finditer(r"(\d+)\s+(\d+)/(\d+)", t): vals.add(int(m[1]) + int(m[2]) / int(m[3]))
    for m in re.finditer(r"(\d+)\s*chains?\s*(?:and\s*)?(\d+)\s*links?", t, re.I): vals.add(int(m[1]) + int(m[2]) / 100)
    for m in re.finditer(r"(\d+)\s*links?\b", t, re.I): vals.add(int(m[1]) / 100)  # links read as hundredths of a chain
    for m in re.finditer(r"\d+(?:\.\d+)?", t): vals.add(float(m[0]))
    for m in _PHRASE.finditer(t):
        p = m[0].lower()
        if _TENTHS.match(t, m.end()) and " and " in p:  # "one hundred twenty-one and nine tenths"
            whole, frac = p.rsplit(" and ", 1)
            w, f = words_to_int(whole), words_to_int(frac)
            if w is not None and f is not None: vals.add(w + f / 10)
        w = words_to_int(p)
        if w is not None: vals.add(float(w))
    return vals
