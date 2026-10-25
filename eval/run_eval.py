"""Sample a model (base + few-shot, or a tuned checkpoint) on the test splits, score it, and cache everything."""
from __future__ import annotations

import argparse, asyncio, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import tinker
from data.gen import END, PROMPT
from eval.metrics import score, summarize
from train.common import PRICES, ROOT, load_env, log_cost, sample_many

SPLITS = ["val", "test_id", "test_heldout_style", "test_heldout_unit"]


def fewshot_prefix(k: int) -> str:
    rows = [json.loads(l) for l in open(ROOT / "data/out/train.jsonl")]
    by_style = {}
    for r in rows:
        if r["curves"] == 0 and r["n_calls"] <= 5: by_style.setdefault(r["style"], r)
    shots = [by_style[s] for s in ["modern_sym", "archaic_abbr", "archaic_chains", "modern_dash"][:k]]
    return "".join(PROMPT.format(text=s["text"]) + s["completion"] + END + "\n\n" for s in shots)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True); ap.add_argument("--base", default="Qwen/Qwen3-8B")
    ap.add_argument("--path", help="tinker:// sampler checkpoint path for a tuned model"); ap.add_argument("--fewshot", type=int, default=0)
    ap.add_argument("--n", type=int, default=0, help="limit examples per split (0 = all)"); ap.add_argument("--splits", nargs="*", default=SPLITS)
    a = ap.parse_args()
    load_env()
    svc = tinker.ServiceClient()
    sc = svc.create_sampling_client(model_path=a.path) if a.path else svc.create_sampling_client(base_model=a.base)
    tok = sc.get_tokenizer()
    prefix = fewshot_prefix(a.fewshot) if a.fewshot else ""
    report, tot_p, tot_o = {}, 0, 0
    for split in a.splits:
        rows = [json.loads(l) for l in open(ROOT / f"data/out/{split}.jsonl")]
        if a.n: rows = rows[: a.n]  # rows are generated cycling through styles, so a prefix covers every style
        outs = await sample_many(sc, tok, {r["id"]: prefix + PROMPT.format(text=r["text"]) for r in rows}, ROOT / f"cache/{a.tag}/{split}.jsonl")
        for r in rows: r.update(out=outs[r["id"]]["text"], minlp_num=outs[r["id"]]["minlp_num"], minlp_all=outs[r["id"]]["minlp_all"])
        tot_p += sum(o["n_prompt"] for o in outs.values() if o.get("new")); tot_o += sum(o["n_out"] for o in outs.values() if o.get("new"))
        agg = score(rows); report[split] = agg
        print(f"\n## {a.tag} / {split}\n" + summarize(agg))
        (ROOT / f"results/{a.tag}__{split}__rows.jsonl").write_text("\n".join(json.dumps({k: r[k] for k in ("id", "style", "text", "completion", "out", "minlp_num", "minlp_all")}) for r in rows))
    (ROOT / f"results/{a.tag}.json").write_text(json.dumps(report, indent=1))
    p = PRICES[a.base]; usd = tot_p * p["prefill"] / 1e6 + tot_o * p["sample"] / 1e6
    print(f"\ntokens prompt={tot_p} out={tot_o}  est ${usd:.3f}")
    if tot_p: log_cost(f"eval {a.tag}", a.path or a.base, f"{tot_p:,} prefill + {tot_o:,} sampled", usd, f"exact {report[a.splits[0]]['all']['exact']}/{report[a.splits[0]]['all']['n']} on {a.splits[0]}")


if __name__ == "__main__":
    asyncio.run(main())
