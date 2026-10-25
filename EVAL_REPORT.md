# Evaluation report

All numbers are computed by `eval/report.py` from the saved model outputs in `results/`. Costs are estimates from token counts × list price (see COST_LOG.md).

**Definitions.** *Example exact*: every field of every call, the point of beginning and the call count all match the ground truth. *Field accuracy*: per field, over all calls. *Flag rate*: outputs sent to a human (any safety check fails). *Silent error*: output is wrong AND not flagged; a flagged-but-wrong output is not silent. *Silent, physical*: the same count where `87 link` and `0.87 chain` are treated as the same call (see below).

## 1. Final model (Qwen3-8B + LoRA, 2,300 training deeds, 3 epochs)


| model / test set | n | example exact | bearing | distance | unit | reference | flag rate | silent errors (rate, 95% upper) | silent, physical |
|---|---|---|---|---|---|---|---|---|---|
| v2: in-distribution, fresh 3,000 deeds (generated before any validator change, evaluated once) | 3000 | 99.6% | 99.97% | 99.90% | 99.89% | 99.98% | 0.4% | 2 (0.07%, ≤0.24%) | 0 |
| v2: in-distribution, 500 deeds | 500 | 99.8% | 100.00% | 100.00% | 100.00% | 99.97% | 0.4% | 0 (0.00%, ≤0.76%) | 0 |
| v2: spelled-out numbers, fresh 250 (style onboarded with 150 examples) | 250 | 99.6% | 100.00% | 99.94% | 100.00% | 100.00% | 0.4% | 0 (0.00%, ≤1.51%) | 0 |
| v2: varas, fresh 250 (unit onboarded with 150 examples) | 250 | 100.0% | 100.00% | 100.00% | 100.00% | 100.00% | 0.0% | 0 (0.00%, ≤1.51%) | 0 |

## 2. Generalization to a style/unit the model has never seen (v1: trained on the six base styles only)


| model / test set | n | example exact | bearing | distance | unit | reference | flag rate | silent errors (rate, 95% upper) | silent, physical |
|---|---|---|---|---|---|---|---|---|---|
| base Qwen3-8B, 3-shot, spelled-out (held out) | 60 | 16.7% | 97.92% | 95.58% | 99.48% | 79.22% | 66.7% | 10 (16.67%, ≤28.03%) | 10 |
| v1 tuned, spelled-out (held out) | 250 | 85.6% | 99.63% | 97.76% | 99.94% | 99.88% | 14.4% | 0 (0.00%, ≤1.51%) | 0 |
| base Qwen3-8B, 3-shot, varas (held out) | 60 | 10.0% | 99.23% | 99.74% | 99.74% | 75.77% | 76.7% | 8 (13.33%, ≤24.17%) | 8 |
| v1 tuned, varas (held out) | 250 | 20.8% | 16.05% | 16.05% | 16.05% | 16.05% | 79.2% | 0 (0.00%, ≤1.51%) | 0 |

The v1 varas row is not a reading failure: bearings and distances were correct, but the model wrote the unit as `var`/`varas`/`vara` (it had never seen the token), which the strict decoder rejects, so every output was flagged and none was silent. Adding 150 varas examples (v2) fixed it completely. The v1 spelled-out row is the honest zero-shot generalization number.

## 3. Before / after


| model / test set | n | example exact | bearing | distance | unit | reference | flag rate | silent errors (rate, 95% upper) | silent, physical |
|---|---|---|---|---|---|---|---|---|---|
| base 3-shot, in-distribution | 60 | 10.0% | 83.92% | 83.92% | 85.56% | 62.67% | 81.7% | 5 (8.33%, ≤18.07%) | 5 |
| tuned v2, in-distribution | 500 | 99.8% | 100.00% | 100.00% | 100.00% | 99.97% | 0.4% | 0 (0.00%, ≤0.76%) | 0 |

The base row uses only 60 deeds (cost cap on the baseline), so its silent-error bound is wide.

## 4. Which safety check catches what (final model, 3,000 fresh deeds)

Wrong outputs: 12 of 3000.

| checks enabled (cumulative) | flagged | silent errors | silent rate (95% upper) |
|---|---|---|---|
| parse | 1 (0.03%) | 11 | 0.37% (≤0.66%) |
| + closure | 10 (0.33%) | 2 | 0.07% (≤0.24%) |
| + numbers in own clause | 10 (0.33%) | 2 | 0.07% (≤0.24%) |
| + monument in own clause | 13 (0.43%) | 2 | 0.07% (≤0.24%) |
| + independent reader | 13 (0.43%) | 2 | 0.07% (≤0.24%) |
| + model confidence | 13 (0.43%) | 2 | 0.07% (≤0.24%) |

The independent reader and the confidence threshold were added after looking at errors from earlier, smaller runs (n=500). They were frozen before this 3,000-deed set was evaluated.

## 5. Flag-rate vs silent-error tradeoff (confidence threshold sweep)

| min-number-logprob floor | flag rate | silent errors |
|---|---|---|
| off | 0.43% | 2 (0.07%) |
| -0.2 | 0.43% | 2 (0.07%) |
| -0.3 | 0.43% | 2 (0.07%) |
| -0.5 | 0.43% | 2 (0.07%) |
| -0.75 | 0.43% | 2 (0.07%) |
| -1.0 | 0.43% | 2 (0.07%) |
| -1.5 | 0.43% | 2 (0.07%) |
| -2.0 | 0.43% | 2 (0.07%) |
| -3.0 | 0.43% | 2 (0.07%) |
| -5.0 | 0.43% | 2 (0.07%) |

## 6. Learning curve: accuracy per dollar (v1 recipe, in-distribution, 500 test deeds)

| training | est. train cost | example exact | flag rate | silent errors |
|---|---|---|---|---|
| 250 deeds | $0.04 | 38.6% | 57.8% | 19 |
| 500 | $0.08 | 92.6% | 7.6% | 0 |
| 1,000 | $0.17 | 99.4% | 0.8% | 0 |
| 2,000 · 1 epoch | $0.34 | 99.6% | 0.6% | 0 |
| 2,000 · 3 epochs | $1.01 | 99.8% | 0.4% | 0 |

## 7. What this does and does not show

- **The silent-error number rests on closure.** Of 12 wrong outputs on the 3,000-deed set, 10 were caught by parse/closure alone. The independent reader and the confidence floor added no further catches here (they did catch the two errors that closure missed in the earlier 500-deed runs: a dropped arc-minute and a flipped curve direction). The model is very confident even when wrong, so the logprob floor carries almost no signal (section 5).
- **Closure cannot see some errors.** A curve direction flip or a wrong monument label leaves the geometry closed. Those depend on the per-clause checks, which only work when the deed's calls are separated by `;` or `thence`/`then` and the clause count lines up.
- **The two remaining strict silent errors are label ambiguity, not misreadings.** `87 links` was labelled `87 link` by one style and `0.87 chain` by another in my generator; the model wrote `0.87 chain`. Physically identical, so the *physical* silent count is 0.
- **The 95% upper bound on the silent-error rate is 0.24%, not 0.1%.** The point estimate (2/3,000 = 0.07%) meets the target, but 3,000 deeds cannot prove it; that would need roughly 3x as many with no new silent errors.
- **All of this is synthetic.** The test deeds come from the same generator as the training deeds. Held-out styles and units test generalization to new phrasing of the same task, not to real deeds. Real-deed accuracy is unmeasured until real descriptions are labelled.
- **Held-out generalization was not good.** Zero-shot on a fully spelled-out style, the tuned model read 85.6% exactly and flagged 14.4% (mostly dropped words like `one thousand seven` read as 17); on a new unit it could not name the unit at all. 150 examples per new style or unit fixed both, which is the intended workflow, but it is a data cost, not generalization.
- **Per-deed cost is small but not zero.** Sampling the 3,000 deeds cost about $0.45 at list price (~$0.00015 per deed). Offline, it costs electricity.

## 8. Offline on a laptop (MLX, 4-bit base + LoRA, Apple M3 Pro, 18 GB)

First 150 deeds of the 3,000-deed in-distribution set, no network, no Tinker: **150/150 exactly right, 0 flagged, 0 silent**; median **7.5 s per deed** at 21.4 tokens/s. Same adapter as the cloud run, base weights quantized to 4-bit (about 4.6 GB). 150 deeds is a small sample; it shows quantization did not visibly hurt, not that it is lossless. Speed is memory-bandwidth bound; fusing the LoRA into the weights or prompt-lookup speculative decoding could be faster and was not tried.
