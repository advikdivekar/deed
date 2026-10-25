# DeedReader

Paste a metes-and-bounds legal description. Get structured calls, a closure check done in plain code, a plotted parcel, and an honest **NEEDS HUMAN REVIEW** whenever anything is off. A fine-tuned open-weight model (Qwen3-8B + LoRA, trained on [Tinker](https://thinkingmachines.ai/tinker/) for about $2.5) does the reading; deterministic code does everything that must be right.

Built for the DEV Hacktoberfest Open-Source AI Challenge, Week 3. **Read [EVAL_REPORT.md](EVAL_REPORT.md) before trusting any number here: everything is measured on synthetic deeds, and real-deed accuracy is unmeasured.**

## Results (synthetic test deeds; details and caveats in EVAL_REPORT.md)
| | base Qwen3-8B, 3-shot | tuned (v2) |
|---|---|---|
| deeds read exactly right (in-distribution) | 10% (n=60) | 99.6% (n=3,000) |
| flagged for a human | 82% | 0.4% |
| silent errors (wrong AND unflagged) | 5 of 60 | 2 of 3,000 (0.07%, 95% upper bound 0.24%); 0 if `87 link` = `0.87 chain` |
| training cost | n/a | about $1.15 (est.) |

Unseen style/unit, zero-shot: spelled-out numbers 85.6% exact (14.4% flagged, 0 silent); varas 0% usable (the model could not name the unit; all flagged). 150 examples each fixed both. Do not read the 99.6% as a real-world number.

## Layout
```
deedreader/   geo.py (closure, area, curves, unit math, single-field fixes)  fmt.py (compact output format)  validate.py (every safety check)  words.py
data/         gen.py (generator, data card in DATA_CARD.md)  gen_extra.py
train/        sft.py (Tinker LoRA SFT, pipelined)  common.py (cached async sampling, cost log)
eval/         metrics.py  run_eval.py  report.py  rescore.py  make_replays.py  parity_dump.py
app/web/      Next.js UI (landing, studio, evidence)   app/api.py  optional live backend
offline/      download_adapter.py  run_local.py (MLX, no internet)
tests/        python tests (closure math, units, validator, generator, metrics)
COST_LOG.md  EVAL_REPORT.md  DATA_CARD.md
```

## Run it
```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python tinker numpy matplotlib pytest transformers fastapi uvicorn mlx-lm
echo 'TINKER_API_KEY=...' > .env          # never committed (.gitignore)
.venv/bin/python data/gen.py && .venv/bin/python data/gen_extra.py
.venv/bin/python -m pytest -q tests                                        # closure math, units, validator, generator
.venv/bin/python train/sft.py --tag mine --n 2000 --epochs 3 --extra data/out/train_v2_extra.jsonl
.venv/bin/python eval/run_eval.py --tag mine_ep3 --path tinker://.../sampler_weights/mine-ep3
.venv/bin/python eval/report.py
cd app/web && npm install && npm run dev                                   # the UI, with recorded replays of the tuned model
cd app/web && npm test                                                     # TS math + parity with the Python validator (5,490 cases)
```

## Offline (no internet, no Tinker key)
```bash
.venv/bin/python offline/download_adapter.py tinker://.../sampler_weights/NAME offline/adapters/NAME   # once, 369 MB
huggingface-cli download mlx-community/Qwen3-8B-4bit                                                   # once, ~4.6 GB
.venv/bin/python offline/run_local.py --adapter offline/adapters/NAME --text "Beginning at an iron pin ..."
```
Runs on the Apple GPU through MLX, 4-bit base plus the LoRA applied at run time. Measured: see EVAL_REPORT.md section 8.

## How the safety net works
The model's output is accepted only if all of these pass; any failure marks the deed NEEDS HUMAN REVIEW and, for closure failures, tries every single-field fix (quadrant flips, transposed digits) and reports the one that closes it:
1. it parses; 2. the parcel closes (1:5,000 by default, configurable); 3. every number is present in its own clause of the deed; 4. every monument label is backed by words in its clause; 5. an independent regex reader, where it can read the clause, agrees on bearing, distance and curve direction; 6. the model's least-confident number token is above a floor (carries almost no signal in practice; see report).

## Honest limits
Synthetic data only; generator grammar is narrow. Clause checks assume calls are separated by `;` or `thence`. Curves are chord-form only. Not a substitute for a licensed surveyor.
