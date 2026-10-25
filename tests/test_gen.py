"""The generator's own ground truth must pass every validator check; otherwise a perfect model would be flagged."""
import json, collections
from pathlib import Path
from deedreader.validate import check

OUT = Path(__file__).resolve().parent.parent / "data" / "out"


def test_truth_passes_validator():
    bad = collections.Counter(); n = 0; examples = []
    for f in OUT.glob("*.jsonl"):
        for line in open(f):
            d = json.loads(line); n += 1
            v = check(d["text"], d["completion"])
            if v.needs_review:
                bad[f.stem + ":" + d["style"]] += 1
                if len(examples) < 5: examples.append((d["style"], v.flags[:2], d["text"][:200]))
    assert n >= 3000
    # OCR-damaged monument words ("stoke", "whlte oak") are correctly sent to a human; anything else, or >0.5% overall, is a validator bug
    assert set(k.split(":")[1] for k in bad) <= {"ocr"}, (dict(bad), examples)
    assert sum(bad.values()) / n < 0.005, (dict(bad), examples)


def test_no_text_leaks_between_splits():
    seen = {}
    for f in OUT.glob("*.jsonl"):
        for line in open(f):
            t = json.loads(line)["text"]
            assert t not in seen or seen[t] == f.stem, f"leak {f.stem} / {seen[t]}"
            seen[t] = f.stem


def test_heldout_styles_absent_from_train():
    styles = {json.loads(l)["style"] for l in open(OUT / "train.jsonl")}
    assert "spelled" not in styles
    units = {c.split()[ -3 ] for l in open(OUT / "train.jsonl") for c in json.loads(l)["completion"].splitlines() if c[:1] in "LC" for c in [c.split("|")[0]]}
    assert "vara" not in units
