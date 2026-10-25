"""Optional live backend for the web UI: POST /api/read {text} -> the model's compact output + confidence.
Online mode samples the tuned checkpoint on Tinker (TINKER_SAMPLER_PATH). Offline mode is in offline/.
Run: .venv/bin/uvicorn app.api:app --port 8000   (then start the UI with NEXT_PUBLIC_BACKEND=1)"""
from __future__ import annotations

import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from fastapi import FastAPI
from pydantic import BaseModel

from data.gen import END, PROMPT
from deedreader.validate import check
from train.common import load_env

app = FastAPI(title="DeedReader API")
_state: dict = {}


class Req(BaseModel):
    text: str


def _client():
    if "sc" not in _state:
        import tinker
        load_env()
        path = os.environ["TINKER_SAMPLER_PATH"]
        sc = tinker.ServiceClient().create_sampling_client(model_path=path)
        _state.update(sc=sc, tok=sc.get_tokenizer())
    return _state["sc"], _state["tok"]


@app.post("/api/read")
async def read(req: Req):
    from tinker import types
    sc, tok = _client()
    ids = tok.encode(PROMPT.format(text=req.text))
    r = await sc.sample_async(prompt=types.ModelInput.from_ints(ids), num_samples=1, sampling_params=types.SamplingParams(max_tokens=420, temperature=0.0, stop=["END"]))
    s = r.sequences[0]; toks, lps = list(s.tokens), list(s.logprobs or [])
    out = tok.decode(toks).split("END")[0]
    num_lps = [lp for t, lp in zip(toks, lps) if any(c.isdigit() for c in tok.decode([t]))]
    mn = min(num_lps) if num_lps else None
    v = check(req.text, out, mn)
    return {"output": out, "minlp_num": mn, "n_prompt": len(ids), "n_out": len(toks), "flags": v.flags}


@app.get("/api/health")
def health(): return {"ok": True}
