"""Pick representative test deeds from a tuned-model eval and write app/web/public/replays.json (real model outputs, recorded).
Includes at least one held-out-style, one held-out-unit, one curve, one OCR, and the model's worst failures so the demo shows the safety net, not just wins."""
from __future__ import annotations

import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from eval.metrics import compare
from deedreader.validate import check

ROOT = Path(__file__).resolve().parent.parent
TITLES = {"modern_sym": "Modern subdivision lot", "modern_dash": "Surveyor shorthand", "modern_words": "Bearings in words", "archaic_abbr": "Old tract, abbreviated",
          "archaic_chains": "1800s chains and links", "ocr": "Scanned deed (OCR noise)", "spelled": "Every number spelled out", "varas": "Texas varas"}
BLURB = {"spelled": "Held-out style: never seen in training", "varas": "Held-out unit: varas were never in training", "ocr": "Broken lines, odd symbols, damaged words",
         "archaic_chains": "Chains, links and old phrasing", "modern_dash": "N41-00-00E style with a curve", "modern_sym": "Feet and DMS bearings", "modern_words": "Words for every bearing", "archaic_abbr": "Poles, rods, 'due north'"}


def load_rows(tag, splits):
    out = []
    for sp in splits:
        toks = {}
        for l in open(ROOT / f"cache/{tag}/{sp}.jsonl"):
            d = json.loads(l); toks[d["id"]] = (d["n_prompt"], d["n_out"])
        for l in open(ROOT / f"results/{tag}__{sp}__rows.jsonl"):
            r = json.loads(l); r["split"] = sp; r["tok"] = toks[r["id"]]; r["tag"] = tag; out.append(r)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="v2_ep3"); ap.add_argument("--splits", nargs="*", default=["test_id_big", "test_spelled_fresh", "test_varas_fresh"])
    ap.add_argument("--catch-tag", default="tuned_ep3"); ap.add_argument("--catch-splits", nargs="*", default=["test_heldout_style"])
    a = ap.parse_args()
    rows = load_rows(a.tag, a.splits); catch = load_rows(a.catch_tag, a.catch_splits)
    for r in rows + catch:
        res, exact = compare(r["completion"], r["out"]); res.pop("_physical_exact"); v = check(r["text"], r["out"], r["minlp_num"])
        r["exact"], r["flagged"], r["ncalls"] = exact, v.needs_review, len(res["bearing"])
        r["curves"] = sum(1 for ln in r["completion"].splitlines() if ln.startswith("C "))
    picks, seen = [], set()
    def take(pool, pred, n=1, key=lambda r: len(r["text"])):
        for r in sorted((r for r in pool if pred(r) and r["id"] not in seen), key=key)[:n]: picks.append(r); seen.add(r["id"])
    for st in ["modern_sym", "modern_dash", "archaic_chains", "ocr", "spelled", "varas"]:
        take(rows, lambda r, st=st: r["style"] == st and r["exact"] and not r["flagged"] and 4 <= r["ncalls"] <= 8 and (r["curves"] == 0 or st in ("modern_dash", "modern_sym")), key=lambda r: (-r["curves"], -r["ncalls"]))
    take(catch, lambda r: r["flagged"] and not r["exact"] and 4 <= r["ncalls"] <= 8, 1, key=lambda r: r["ncalls"])
    out = []
    for r in picks:
        caught = r["flagged"] and not r["exact"]
        out.append({"id": r["id"], "title": TITLES[r["style"]] + (" with curves" if r["curves"] else "") + (" (zero-shot)" if caught else ""),
                    "blurb": BLURB[r["style"]] + (" · an early model misread this deed and the checks flagged it" if caught else ""),
                    "style": r["style"], "heldout": r["style"] in ("spelled", "varas") and not caught, "text": r["text"], "output": r["out"], "minlp_num": r["minlp_num"],
                    "n_prompt": r["tok"][0], "n_out": r["tok"][1], "model": "Qwen3-8B + LoRA (v1)" if caught else "Qwen3-8B + LoRA (v2)"})
    (ROOT / "app/web/public").mkdir(parents=True, exist_ok=True)
    (ROOT / "app/web/public/replays.json").write_text(json.dumps(out, indent=1))
    print(f"wrote {len(out)} replays:", [(o['title'], o['heldout']) for o in out])


if __name__ == "__main__":
    main()
