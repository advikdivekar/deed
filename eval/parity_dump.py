"""Dump (source, output, per-check verdicts from the PYTHON validator) so the TypeScript port can be tested against it."""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from deedreader.fmt import decode
from deedreader.geo import closure
from deedreader.validate import crosscheck, provenance, ref_grounding

ROOT = Path(__file__).resolve().parent.parent
rng = random.Random(5)
cases = []
def add(text, out):
    pob, calls, errs = decode(out)
    cl = closure(calls) if calls else None
    cases.append(dict(text=text, output=out, parse_ok=not errs, closes=bool(cl and cl.closed),
                      numbers_ok=not provenance(text, calls) if calls else True, refs_ok=not ref_grounding(text, calls) if calls else True, cross_ok=not crosscheck(text, calls) if calls else True))
for f in ROOT.glob("results/*__rows.jsonl"):
    for l in open(f):
        r = json.loads(l); add(r["text"], r["out"])
for sp in ["test_id", "test_heldout_style", "test_heldout_unit"]:
    for i, l in enumerate(open(ROOT / f"data/out/{sp}.jsonl")):
        if i >= 60: break
        d = json.loads(l); lines = d["completion"].splitlines()
        add(d["text"], d["completion"])
        k = rng.randrange(1, len(lines)); parts = lines[k].split()
        if len(parts) > 6:  # corrupt: transpose digits in the distance or swap the monument
            if rng.random() < .5 and len(parts[6]) > 2: parts[6] = parts[6][1] + parts[6][0] + parts[6][2:]
            else: parts[1] = "S" if parts[1] == "N" else "N"
            lines[k] = " ".join(parts)
        add(d["text"], "\n".join(lines))
(ROOT / "app/web/lib/parity.json").write_text(json.dumps(cases))
print(len(cases), "cases")
