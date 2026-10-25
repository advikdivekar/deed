"""Re-score saved model outputs (results/<tag>__<split>__rows.jsonl) with the current validator. No API calls, no cost."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from eval.metrics import score, summarize

ROOT = Path(__file__).resolve().parent.parent

def load(tag, split):
    return [json.loads(l) for l in open(ROOT / f"results/{tag}__{split}__rows.jsonl")]

if __name__ == "__main__":
    tags, splits = sys.argv[1].split(","), sys.argv[2].split(",")
    for t in tags:
        for sp in splits:
            f = ROOT / f"results/{t}__{sp}__rows.jsonl"
            if not f.exists(): continue
            a = score(load(t, sp))["all"]; n = a["n"]
            print(f"{t:14s} {sp:20s} n={n:4d} exact={100*a['exact']/n:5.1f}% flagged={100*a['flagged']/n:5.1f}% silent={a['silent']}")
