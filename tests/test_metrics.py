from data.gen import make_example
import random
from eval.metrics import compare, score


def test_truth_scores_perfect_and_unflagged():
    rng = random.Random(3)
    rows = []
    for i in range(60):
        ex = make_example(rng, ["modern_sym", "archaic_chains", "ocr", "modern_dash"][i % 4]); ex["out"] = ex["completion"]; ex["minlp_num"] = -0.01
        rows.append(ex)
    a = score(rows)["all"]
    assert a["exact"] == 60 and a["flagged"] == 0 and a["silent"] == 0


def test_corrupted_output_is_flagged_not_silent():
    rng = random.Random(4); ex = make_example(rng, "modern_sym")
    lines = ex["completion"].splitlines(); parts = lines[1].split(); parts[6] = "103.2" if parts[6] != "103.2" else "130.2"; lines[1] = " ".join(parts)
    ex["out"] = "\n".join(lines); ex["minlp_num"] = -0.01
    res, exact = compare(ex["completion"], ex["out"])
    assert not exact
    a = score([ex])["all"]
    assert a["silent"] == 0 and a["wrong_flagged"] == 1


def _first_with(style, pred, seed=11):
    rng = random.Random(seed)
    while True:
        ex = make_example(rng, style)
        if pred(ex): return ex


def test_crossreader_catches_dropped_arcminute():
    ex = _first_with("modern_dash", lambda e: any(l.split()[3] != "0" for l in e["completion"].splitlines()[1:] if l.startswith("L")))
    lines = ex["completion"].splitlines(); k = next(i for i, l in enumerate(lines) if l.startswith("L") and l.split()[3] != "0")
    p = lines[k].split(); p[3] = "0"; lines[k] = " ".join(p)
    ex["out"] = "\n".join(lines); ex["minlp_num"] = -0.01
    a = score([ex])["all"]
    assert a["exact"] == 0 and a["flagged"] == 1 and a["silent"] == 0


def test_crossreader_catches_flipped_curve_direction():
    ex = _first_with("modern_sym", lambda e: e["curves"] > 0)
    ex["out"] = "\n".join(l[:-len(l.split("|")[1]) - 4] + ("R" if l.split(" | ")[0].endswith("L") else "L") + " |" + l.split("|")[1] if l.startswith("C ") else l for l in ex["completion"].splitlines())
    ex["minlp_num"] = -0.01
    assert score([ex])["all"]["silent"] == 0 and score([ex])["all"]["flagged"] == 1
