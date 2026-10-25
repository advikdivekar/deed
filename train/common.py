"""Shared Tinker plumbing: env loading, cached async sampling, and the cost log. The API key is read from the environment only."""
from __future__ import annotations

import asyncio, json, os, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRICES = {  # USD per 1M tokens, from thinkingmachines.ai/tinker/pricing as of 2026-10-19. Re-verify before big spends.
    "Qwen/Qwen3-8B": dict(prefill=0.195, sample=0.60, train=0.44),
    "openai/gpt-oss-20b": dict(prefill=0.18, sample=0.45, train=0.396),
    "Qwen/Qwen3.5-4B": dict(prefill=0.33, sample=1.005, train=0.737),
}


def load_env():
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    if not os.environ.get("TINKER_API_KEY"): raise SystemExit("TINKER_API_KEY is not set (put it in .env or export it)")


def log_cost(job: str, model: str, detail: str, usd: float, result: str):
    f = ROOT / "COST_LOG.md"
    if not f.exists():
        f.write_text("# Cost log\n\nCosts are ESTIMATES from token counts x list price (pricing page dated 2026-10-19), not billed amounts, unless marked billed.\n\n| time (UTC) | job | model | tokens / steps | est. cost | result |\n|---|---|---|---|---|---|\n")
    with open(f, "a") as fh:
        fh.write(f"| {time.strftime('%Y-%m-%d %H:%M', time.gmtime())} | {job} | {model} | {detail} | ${usd:.3f} | {result} |\n")


def spent_so_far() -> float:
    f = ROOT / "COST_LOG.md"
    if not f.exists(): return 0.0
    tot = 0.0
    for line in f.read_text().splitlines():
        cells = [c.strip() for c in line.split("|")]
        if len(cells) > 6 and cells[5].startswith("$"):
            try: tot += float(cells[5][1:])
            except ValueError: pass
    return tot


async def sample_many(sampling_client, tok, prompts: dict[str, str], cache: Path, max_tokens=420, temperature=0.0, concurrency=24, stop=("END",)):
    """prompts: id -> prompt text. Returns id -> dict(text, minlp_all, minlp_num, n_prompt, n_out). Cached on disk by id; never resamples."""
    from tinker import types
    done: dict[str, dict] = {}
    if cache.exists():
        for line in cache.open():
            d = json.loads(line); done[d["id"]] = d
    todo = [(i, p) for i, p in prompts.items() if i not in done]
    sem = asyncio.Semaphore(concurrency)
    cache.parent.mkdir(parents=True, exist_ok=True)
    fh = cache.open("a")

    async def one(i: str, p: str):
        ids = tok.encode(p)
        async with sem:
            r = await sampling_client.sample_async(prompt=types.ModelInput.from_ints(ids), num_samples=1,
                                                   sampling_params=types.SamplingParams(max_tokens=max_tokens, temperature=temperature, stop=list(stop)))
        s = r.sequences[0]
        toks, lps = list(s.tokens), list(s.logprobs or [])
        text = tok.decode(toks)
        for st in stop: text = text.split(st)[0]
        num_lps = [lp for t, lp in zip(toks, lps) if any(ch.isdigit() for ch in tok.decode([t]))]
        d = dict(id=i, text=text, minlp_all=min(lps) if lps else None, minlp_num=min(num_lps) if num_lps else None, n_prompt=len(ids), n_out=len(toks), cache_hit=r.prompt_cache_hit_tokens)
        fh.write(json.dumps(d) + "\n"); fh.flush(); done[i] = dict(d, new=True)  # 'new' marks tokens billed by this run, so cached re-scores cost nothing in the log

    t0 = time.time()
    await asyncio.gather(*(one(i, p) for i, p in todo))
    fh.close()
    print(f"sampled {len(todo)} new ({len(prompts) - len(todo)} cached) in {time.time() - t0:.0f}s")
    return {i: done[i] for i in prompts}
