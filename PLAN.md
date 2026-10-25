# DeedReader: plan and cost estimate

Prices are from Tinker's pricing page (as of 2026-10-19), USD per 1M tokens. Re-verify before spending.

| Model (small tier) | Train | Sample | Prefill |
|---|---|---|---|
| GPT-OSS-20B | 0.396 | 0.45 | 0.18 |
| Qwen3-8B | 0.44 | 0.60 | 0.195 |
| Qwen3.5-4B | 0.737 | 1.005 | 0.33 |
| Nemotron-3-Nano-30B-A3B | 0.44 | 0.495 | 0.195 |

Assumptions: ~600 tokens per example (prompt ~350 + JSON ~250), 1,000 test items, 2,000 train items.

| Rung | What | Est. tokens | Est. cost |
|---|---|---|---|
| 0 | Read Tinker docs, verify API, checkpoints download | 0 | $0 |
| 1 | Few-shot baseline on 1k test items (2 candidate models; few-shot prompt ~2k tokens prefill, cached after first) | ~3M prefill + 0.3M sample each | ~$1-2 total |
| 2 | Closure/units/plot in code + tests | 0 | $0 |
| 3 | LoRA SFT, 2k examples x 3 epochs = ~3.6M train tokens, then eval (~1M tokens) | 4.6M | ~$2-4 per model (Qwen3-8B: ~$1.6 train) |
| 3b | Scale to 10k examples only if eval says so | ~18M train | ~$8-13 |
| 4 | Best-of-n / rejection sampling with closure as reward (n=8 on 2k prompts) | ~10M sample | ~$5-8; RL (GRPO/PPO) exists in Tinker but costs more, last resort |

Expected total to hit targets: **$5-15**. Hard cap: **$X** (you set it). I stop and ask at 50% of it.

Order: baseline -> deterministic code -> SFT -> (only if short) verifiable-reward cleanup. Every job is logged in COST_LOG.md.

Honesty note: 99.9% silent-error is achieved by closure check + abstention, not by the model being 99.9% right. Closure cannot catch errors that preserve closure (e.g., swapped order of two calls, wrong reference name, wrong unit with consistent scaling is NOT closure-preserving but a dropped-and-compensated pair is). The eval will measure this explicitly.
