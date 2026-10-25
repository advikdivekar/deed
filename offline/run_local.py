"""Run the tuned model on this Mac with no internet and no Tinker key: MLX (Apple GPU), 4-bit Qwen3-8B base + the downloaded LoRA adapter.

    python offline/run_local.py --adapter offline/adapters/v2-ep3 --text "Beginning at an iron pin ... thence N 41°00' E 121.9 feet ..."
    python offline/run_local.py --adapter offline/adapters/v2-ep3 --eval 100      # accuracy + speed on saved test deeds

The base model comes from the local Hugging Face cache (download it once with `huggingface-cli download mlx-community/Qwen3-8B-4bit`).
The adapter is applied on top of the 4-bit weights at run time, so there is no merge step and nothing leaves the machine.
"""
from __future__ import annotations

import argparse, json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import mlx.core as mx
import mlx.nn as nn
from mlx_lm import load
from mlx_lm.models.cache import make_prompt_cache
from safetensors import safe_open

from data.gen import PROMPT
from deedreader.validate import check

BASE = "mlx-community/Qwen3-8B-4bit"


class LoRAWrap(nn.Module):
    """y = base(x) + scale * (x A^T) B^T, with the base left in 4-bit."""
    def __init__(self, base, A, B, scale):
        super().__init__(); self.base, self.A, self.B, self.scale = base, A, B, scale
    def __call__(self, x):
        return self.base(x) + self.scale * ((x @ self.A.T) @ self.B.T).astype(x.dtype)


def load_model(adapter_dir: str, base: str = BASE):
    model, tok = load(base)
    cfg = json.load(open(Path(adapter_dir) / "adapter_config.json"))
    scale = cfg["lora_alpha"] / cfg["r"]
    f = safe_open(str(Path(adapter_dir) / "adapter_model.safetensors"), "numpy")
    pairs: dict[str, dict] = {}
    for k in f.keys():
        name, ab = k.split(".lora_")[0], k.split(".lora_")[1][0]
        pairs.setdefault(name, {})[ab] = mx.array(f.get_tensor(k)).astype(mx.float16)
    n = 0
    for name, ab in pairs.items():
        path = name.replace("base_model.model.", "", 1)  # model.layers.0.mlp.down_proj | model.unembed_tokens
        if path.endswith("unembed_tokens"):
            parent, attr = model, "lm_head"
        else:
            parts = path.split("."); parent = model
            for p in parts[:-1]: parent = parent[int(p)] if p.isdigit() else getattr(parent, p)
            attr = parts[-1]
        setattr(parent, attr, LoRAWrap(getattr(parent, attr), ab["A"], ab["B"], scale)); n += 1
    mx.eval(model.parameters())
    return model, tok, n


def generate(model, tok, text: str, max_tokens=420):
    ids = tok.encode(PROMPT.format(text=text))
    cache = make_prompt_cache(model)
    y = mx.array(ids)[None]; out_ids, lps = [], []
    t0 = time.time(); first = None
    for _ in range(max_tokens):
        logits = model(y, cache=cache)[:, -1, :].astype(mx.float32)
        lp = logits - mx.logsumexp(logits, axis=-1, keepdims=True)
        nxt = mx.argmax(lp, axis=-1); mx.eval(nxt, lp[0, nxt[0]])
        if first is None: first = time.time() - t0
        t = int(nxt.item()); out_ids.append(t); lps.append(float(lp[0, t].item()))
        if tok.decode(out_ids[-3:]).strip().endswith("END"): break
        y = nxt[None]
    text_out = tok.decode(out_ids).split("END")[0]
    num_lps = [l for t, l in zip(out_ids, lps) if any(c.isdigit() for c in tok.decode([t]))]
    dt = time.time() - t0
    return text_out, (min(num_lps) if num_lps else None), dict(prompt_tokens=len(ids), out_tokens=len(out_ids), seconds=dt, ttft=first, tok_per_s=len(out_ids) / max(dt - (first or 0), 1e-9))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--adapter", required=True); ap.add_argument("--text"); ap.add_argument("--eval", type=int, default=0)
    a = ap.parse_args()
    t0 = time.time(); model, tok, n = load_model(a.adapter); print(f"loaded base + {n} LoRA modules in {time.time() - t0:.1f}s")
    if a.text:
        out, mn, st = generate(model, tok, a.text); v = check(a.text, out, mn)
        print(out); print(st); print("NEEDS HUMAN REVIEW: " + "; ".join(v.flags) if v.needs_review else "all checks pass")
    if a.eval:
        from eval.metrics import compare
        rows = [json.loads(l) for l in open(Path(__file__).resolve().parent.parent / "data/out/test_id_big.jsonl")][: a.eval]
        ok = flagged = silent = 0; tps = []; secs = []; res_rows = []
        for r in rows:
            out, mn, st = generate(model, tok, r["text"]); _, exact = compare(r["completion"], out); v = check(r["text"], out, mn)
            ok += exact; flagged += v.needs_review; silent += (not exact) and not v.needs_review; tps.append(st["tok_per_s"]); secs.append(st["seconds"])
            res_rows.append(dict(id=r["id"], out=out, exact=exact, flagged=v.needs_review))
        n = len(rows)
        print(f"local MLX 4-bit, {n} deeds: exact {100 * ok / n:.1f}%  flagged {100 * flagged / n:.1f}%  silent {silent}  median {sorted(secs)[n // 2]:.1f}s/deed  {sorted(tps)[n // 2]:.1f} tok/s")
        Path("results/local_mlx_eval.json").write_text(json.dumps(dict(n=n, exact=ok, flagged=flagged, silent=silent, median_s=sorted(secs)[n // 2], median_tps=sorted(tps)[n // 2], rows=res_rows)))
