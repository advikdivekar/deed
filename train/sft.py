"""LoRA SFT on Tinker. Loss only on the completion tokens. Pipelined: step k+1 is submitted before step k's result is awaited."""
from __future__ import annotations

import argparse, asyncio, json, random, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import tinker
from tinker import types
from data.gen import END, PROMPT
from train.common import PRICES, ROOT, load_env, log_cost, spent_so_far


def encode_example(tok, r: dict) -> tuple[types.Datum, int]:
    p = tok.encode(PROMPT.format(text=r["text"]))
    c = tok.encode(r["completion"] + END, add_special_tokens=False)
    full = p + c
    d = types.Datum(model_input=types.ModelInput.from_ints(tokens=full[:-1]),
                    loss_fn_inputs=dict(weights=[0.0] * (len(p) - 1) + [1.0] * len(c), target_tokens=full[1:]))
    return d, len(full)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen3-8B"); ap.add_argument("--tag", required=True)
    ap.add_argument("--n", type=int, default=2000); ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--bs", type=int, default=16); ap.add_argument("--lr", type=float, default=2e-4); ap.add_argument("--rank", type=int, default=32)
    ap.add_argument("--extra", nargs="*", default=[], help="extra jsonl files (relative to repo root) appended to the training set")
    ap.add_argument("--budget", type=float, default=20.0, help="hard cap in USD for the whole project (COST_LOG.md total is checked)")
    a = ap.parse_args()
    load_env()
    rows = [json.loads(l) for l in open(ROOT / "data/out/train.jsonl")][: a.n]
    for f in a.extra: rows += [json.loads(l) for l in open(ROOT / f)]
    svc = tinker.ServiceClient()
    tc = await svc.create_lora_training_client_async(base_model=a.base, rank=a.rank)
    tok = tc.get_tokenizer()
    enc = [encode_example(tok, r) for r in rows]
    toks_epoch = sum(n for _, n in enc)
    est = toks_epoch * a.epochs * PRICES[a.base]["train"] / 1e6
    print(f"{len(rows)} examples, {toks_epoch:,} tokens/epoch, est train cost ${est:.2f}; spent so far ${spent_so_far():.2f} / cap ${a.budget:.2f}")
    if spent_so_far() + est > a.budget * 0.5: raise SystemExit(f"STOP: this job would take spend past 50% of the ${a.budget} cap. Ask the user before continuing.")

    steps_per_epoch = len(enc) // a.bs
    total = steps_per_epoch * a.epochs
    rng = random.Random(0)
    order = []
    for _ in range(a.epochs):
        idx = list(range(len(enc))); rng.shuffle(idx); order += [idx[i * a.bs:(i + 1) * a.bs] for i in range(steps_per_epoch)]

    def lr_at(s):  # short warmup, then linear decay to 10%
        w = min(1.0, (s + 1) / 5)
        return a.lr * w * (1 - 0.9 * s / max(total - 1, 1))

    async def submit(s):
        fb = await tc.forward_backward_async([enc[i][0] for i in order[s]], loss_fn="cross_entropy")
        op = await tc.optim_step_async(types.AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
        return fb, op

    t0 = time.time(); pending = await submit(0); ckpts = {}
    for s in range(total):
        nxt = await submit(s + 1) if s + 1 < total else None
        fb, op = pending
        r = await fb.result_async(); await op.result_async()
        if s == 0: print("metrics keys:", sorted(r.metrics))
        if s % 10 == 0 or s == total - 1:
            m = {k: round(v, 4) for k, v in r.metrics.items() if "loss" in k}
            print(f"step {s + 1}/{total} lr={lr_at(s):.2e} {m} {time.time() - t0:.0f}s", flush=True)
        pending = nxt
        if (s + 1) % steps_per_epoch == 0:
            ep = (s + 1) // steps_per_epoch
            res = await (await tc.save_weights_for_sampler_async(name=f"{a.tag}-ep{ep}")).result_async()
            ckpts[f"ep{ep}"] = res.path; print(f"saved epoch {ep}: {res.path}", flush=True)
    (ROOT / f"results/{a.tag}_checkpoints.json").write_text(json.dumps(ckpts, indent=1))
    toks = toks_epoch * a.epochs
    usd = toks * PRICES[a.base]["train"] / 1e6
    log_cost(f"sft {a.tag}", a.base, f"{toks:,} train tokens, {total} steps, bs={a.bs}, rank={a.rank}, lr={a.lr}", usd, f"checkpoints saved: {', '.join(ckpts)}")
    print(f"done in {time.time() - t0:.0f}s, est ${usd:.2f}")


if __name__ == "__main__":
    asyncio.run(main())
