---
title: "I taught a small AI to read property deeds for $1.15, then stopped trusting it"
published: false
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge](https://dev.to/challenges), Week 3: Slow and Steady.*

The deed says **N 86°29' E, 103.2 feet**.

Follow the rest of the deed around the lot and you don't end up where you started. You end up **27 feet away**. Somewhere a digit is wrong. Maybe it was `130.2`. Maybe the scan was blurry. Maybe the AI that read it got it wrong.

You can't tell by looking, and the drawing you make from it will look perfectly fine.

That's the whole problem, and it's why this project exists.

![DeedReader showing a plotted parcel on satellite imagery](docs/screens/03-studio-map.png)

## What I Built

### The problem, in plain words

Every piece of land has a legal description written in words. It's a walk around the edge:

> *Beginning at an iron pin at the corner of Smith's lot, go north-east 118.5 feet to a stone, then south-east 200 feet along the creek, then…, and back to the start.*

People who work with land (surveyors, title researchers, paralegals) turn those words into a drawing by hand. They convert each direction, draw each side, check the shape closes, and work out the area. That's **15 to 30 minutes per deed**, and one wrong digit ruins all of it.

### What DeedReader does

You paste the description. A few seconds later you get:

- the **parcel drawn on a real map** (satellite or street), or as a clean drawing
- the **area** in acres and square feet
- a **closure check**: did the walk come back to where it started?
- **exports** for CAD (DXF), maps (GeoJSON) and images (SVG)
- a plain verdict: **looks right**, or **NEEDS HUMAN REVIEW**, with the exact line to look at

### The one idea

Language models are good at *reading*. They're bad at *being right about numbers*. So I split the job in two:

| | Who | Why |
|---|---|---|
| Read the messy text into a list of sides | a small AI model I fine-tuned | reading is what language models are for |
| Add up the sides, close the shape, find the area, draw it | ordinary code | arithmetic should be exact and testable |
| Check the AI didn't make something up | six more pieces of ordinary code | a model can talk itself into anything. A rule can't |

**The model only reads. Code decides.**

![The model reads, code decides](docs/charts/architecture.png)

If any check fails, DeedReader doesn't guess and doesn't hide it. It marks the result **NEEDS HUMAN REVIEW**. It also tries changing one thing at a time (flip a direction, swap two digits) and tells you which single change would make the parcel close. In the example above, it finds `103.2 → 130.2`.

## Demo

> 🎬 *Demo video: added after this draft is approved.*

The studio is a Next.js app that runs on my laptop. It replays **real recorded outputs of my tuned model** on deeds it never saw in training, and all the safety checks run **live in your browser**. Nothing is faked: the model output is the model's, the checks are real code.

**1. Pick a deed or paste your own.** There are samples in modern language, shorthand, spelled-out numbers ("five hundred forty and two tenths feet"), 1800s phrasing ("to a white oak"), Texas varas, and a noisy scan.

**2. See it on a real map.** The parcel lands on satellite imagery with true directions and distances. Click a sentence in the deed and its side lights up on the map, and the other way round. (The parcel is fictional and placed at an illustrative real location. You can type in your own coordinates.)

**3. Or a clean drawing.** Curves are real arcs.

![The drawing view](docs/screens/03b-studio-drawing.png)

**4. Watch it catch a mistake.** "Simulate a misread" corrupts one number. Three separate checks fail at once and it names the line.

![A misread caught by three checks](docs/screens/04-misread-caught.png)

**5. A real failure, left in.** This is an actual output of an early, untrained model. It was wrong, and it got flagged instead of drawn.

![A real zero-shot failure, caught](docs/screens/05-zero-shot-flagged.png)

**6. The lazy payoff.** On the landing page a clock runs the by-hand workflow (sped up) next to "seconds".

![By hand vs DeedReader](docs/screens/02-race.png)

It works on a phone-width screen too.

## Code

{% github advikdivekar/deed %}

<!-- repo is currently private: make it public before publishing this post -->

`deedreader/` closure math and validator · `data/` synthetic generator · `train/` Tinker SFT · `eval/` metrics and report · `app/web/` Next.js UI · `offline/` run with no internet · `tests/`.

19 Python tests and 7 TypeScript tests pass. The browser validator is tested against the Python one on 5,490 cases with zero disagreements. `EVAL_REPORT.md` has every number below, computed from saved model outputs, and `COST_LOG.md` lists every Tinker job.

## How I Built It (plain version)

1. **I needed lots of deeds with the right answers, and real ones aren't free.** So I wrote a generator that draws a closed shape with *known* directions and distances, then writes it up in many styles: modern legal language, surveyor shorthand, numbers spelled out, 1800s phrasing, a blurry-scan style. I hold two things back on purpose, a **writing style** and a **unit of length** (varas), to see how the model copes with things it hasn't seen. All of it is synthetic, and the data card says so.
2. **I fine-tuned a small open model** (Qwen3-8B) on Tinker. The next section is the technical part.
3. **I wrapped it in checks.** The model's output is never trusted on its own.
4. **I measured the one number that matters.** Not "how often is it right", but **how often is it wrong and nobody notices**. A wrong answer that gets flagged is a person doing their job. A wrong answer that looks fine is the dangerous one.

## Results

| | untrained model (3 examples in the prompt) | **fine-tuned** |
|---|---|---|
| deeds read exactly right | 10% (6 of 60) | **99.6%** (2,988 of 3,000 fresh deeds) |
| sent to a human | 82% | 0.4% |
| **wrong and unflagged** | **5 of 60** | **2 of 3,000** |

I'm not rounding any of that up. The honest range matters more than the headline:

- With 3,000 deeds, the **95% confidence interval for "exactly right" is 99.3% to 99.8%**. I report the lower end.
- The **silent-error rate is 0.07%**, but its 95% upper bound is **0.24%**. 3,000 deeds can't prove it's under 0.1%.
- Both of those two silent errors are my own labelling quirk: my generator calls `87 links` "87 link" in one style and "0.87 chain" in another. It's the same physical length. By physical length, silent errors are **0**. I report both numbers.
- **It's all synthetic.** I haven't measured it on real recorded deeds. Don't use this on real titles without a labelled real set.

![Where every deed ends up](docs/charts/where_deeds_end_up.png)

---

# Best Use of Tinker: the engineering

The brief was *good results at the lowest price*. Everything below is in service of that: how I picked the model, what I did to keep each job small, and how I found the point where more spending stopped helping.

![Fine-tuning pipeline](docs/charts/finetune_pipeline.png)

## 1. Pick the model by price, then verify it by measurement

Tinker publishes per-token prices, so the first filter is arithmetic:

| base model | train $/M tokens | sample $/M tokens |
|---|---|---|
| GPT-OSS-20B | 0.396 | not checked |
| **Qwen3-8B** | **0.44** | 0.60 |
| Qwen3.5-4B | 0.737 | not checked |

A smaller model is *not* automatically cheaper to train here: Qwen3.5-4B costs 67% more per training token than Qwen3-8B. I chose Qwen3-8B as the cheapest model I was confident could read this task, then **tested the choice** with a learning curve (below). I did not benchmark GPT-OSS-20B, which is slightly cheaper on the list, so I can't claim Qwen3-8B was the cheapest *possible* choice. Only the cheapest *tested* one.

## 2. Shrink the data before you shrink the model

My first design emitted JSON. A typical deed's answer was **547 tokens**. I designed a line-per-call format instead:

```
POB iron pin
L N 41 0 0 E 121.9 ft | iron pin
C N 3 45 22 E 366.15 ft R 944.33 ft L | stone
```

Code converts it back to JSON. Measured with the Qwen tokenizer: **145 tokens, 3.8× smaller**. Tinker bills by token, so this one design choice cuts the training bill, the evaluation bill, and the local latency at once. It's the cheapest optimization in the project, because it costs nothing at run time.

## 3. Training setup (the actual knobs)

```python
tc = await svc.create_lora_training_client_async(base_model="Qwen/Qwen3-8B", rank=32)

# loss ONLY on the answer tokens, not the deed text
Datum(model_input=full[:-1],
      loss_fn_inputs=dict(weights=[0.0]*(len(prompt)-1) + [1.0]*len(completion),
                          target_tokens=full[1:]))

fb = await tc.forward_backward_async(batch, loss_fn="cross_entropy")
op = await tc.optim_step_async(AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
```

- **LoRA rank 32**, batch size 16, peak learning rate 2e-4 with a 5-step warmup, then linear decay to 10%.
- **Loss masked to the completion.** The model learns to *write calls*, not to memorize deed prose.
- **Pipelined steps.** I submit step *k+1* before awaiting step *k*'s result, so the service is never idle between my round trips. This saves wall-clock time, not money.
- **A checkpoint every epoch** (`save_weights_for_sampler`), so I can compare epochs without re-training.
- **A budget guard in the training script.** It prices the job from token counts *before* submitting and refuses to start if it would push total spend past half the cap.

## 4. Find the knee of the curve instead of guessing

I didn't train on everything and hope. I trained four runs, one epoch each, and evaluated each on the same 500 held-out deeds:

| training deeds | est. cost | exactly right | silent errors |
|---|---|---|---|
| 250 | $0.04 | 38.6% | 19 |
| 500 | $0.08 | 92.6% | 0 |
| **1,000** | **$0.17** | **99.4%** | 0 |
| 2,000 | $0.34 | 99.6% | 0 |

![Accuracy per dollar](docs/charts/learning_curve.png)

**$0.17 buys 99.4%.** Everything after that is chasing the last 0.2%. The curve is also steep at the bottom: at 250 deeds the model is bad *and unsafe* (19 silent errors). That's the failure you'd miss if you only looked at accuracy.

## 5. Spend extra only where the eval said to

The first full model (2,000 deeds, 3 epochs, $1.01) read my held-out style and unit badly:

| test, never seen in training | exactly right | flagged | silent |
|---|---|---|---|
| numbers spelled out | 85.6% | 14.4% | 0 |
| varas | 20.8% | 79.2% | 0 |

The varas result looked like a disaster, but the model had read every *number* correctly. It wrote the unit as `var`, which my decoder rejected, so everything was flagged. A unit-naming failure, not a reading failure, and (importantly) **zero silent errors**: the net held.

I added the obvious plural alias, and **refused to keep adding aliases** for each spelling the model improvised, because that's fitting the decoder to the test set. The real fix was data: **150 spelled-out and 150 varas examples**, retrain, test on *fresh* deeds. That's the 2,300-deed final model:

| test (fresh deeds) | n | exactly right | silent |
|---|---|---|---|
| in distribution | 3,000 | 99.6% | 2 (0 by physical length) |
| spelled-out numbers | 250 | 99.6% | 0 |
| varas | 250 | 100% | 0 |

I want to be precise about what that means: **a new style or unit costs about 150 examples, and it doesn't come for free.** That's a data cost, not generalization.

## 6. Make the evaluation cost nothing the second time

Evaluation ended up being the bigger bill: **$1.35 against $2.46 for all training runs.** So I made it cheap to repeat:

- Every sampled output is cached by (checkpoint, input). A re-run costs $0.
- The safety checks are scored *offline from the cache*. When I improved the validator, re-scoring 3,000 deeds cost nothing.
- The cost log counts only *newly billed* tokens. (My first version double-counted cached re-scores. Fixed.)
- At inference the whole model costs about **$0.0002 per deed** through Tinker (355 prompt + 212 output tokens).

## 7. Don't trust the model's confidence. Measure it.

I expected the model's own token probabilities to be a free alarm. They aren't. I swept the confidence threshold from "off" to a very strict floor and the flag rate and silent-error count **didn't move at all**. The model is confident even when it's wrong. That's why the safety net is deterministic code, and why I cut the claim from the plan:

| threshold | flag rate | silent errors |
|---|---|---|
| off | 0.43% | 2 |
| -0.5 | 0.43% | 2 |
| -1.5 | 0.43% | 2 |
| -3.0 | 0.43% | 2 |

Of the 12 wrong outputs in the 3,000-deed run, **10 were caught by parse and closure alone.** I added the independent second reader *after* seeing two silent errors at n=500 (a dropped arc-minute, a flipped curve direction). To keep that honest I generated a fresh 3,000-deed set **before** touching the validator, froze it, then evaluated once. The 0.07% comes from that clean set.

## 8. Take the weights and leave

The cheapest inference is the one you don't pay for. I downloaded the **369 MB LoRA adapter** from Tinker and ran it on my laptop with **MLX on the Apple GPU**: a 4-bit Qwen3-8B base with the adapter applied at run time (253 modules, including the output head).

> **150 of 150 deeds exactly right, 0 flagged, median 7.5 s per deed** on an M3 Pro with 18 GB, no network, no API key.

That's a small sample. It shows 4-bit quantization didn't visibly hurt, not that it's lossless. Speed is memory-bandwidth bound; fusing the LoRA into the weights or speculative decoding could be faster, and I didn't try either.

## The bill

| item | est. cost |
|---|---|
| baseline (no training) | $0.11 |
| learning-curve runs (250 / 500 / 1,000) | $0.29 |
| first full run (2,000 deeds, 3 epochs) | $1.01 |
| **final model (2,300 deeds, 3 epochs)** | **$1.15** |
| all evaluation | $1.35 |
| **everything on Tinker** | **about $3.80** |

These are estimates from token counts times Tinker's list prices. Tinker's billing endpoint hadn't reported training or sampling usage when I checked, so they are not billed amounts. If I'd been strict about cost, I'd have stopped one epoch earlier: epoch 2 was already 100% on the 500-deed set, within noise of epoch 3.

---

## Why Does Open Innovation Matter?

I **rented the training and I own the weights.** For about a dollar of Tinker credit I got a model I can download, run offline, and swap out.

- **I could fix the model, not just the prompt.** A general model with examples in the prompt read 10% of deeds right. A small LoRA on an open model read 99.6%. You can't do that to a model you only rent.
- **Deeds stay on the machine.** They name people and parcels, and abstractors work under confidentiality obligations. With open weights on a laptop there's no "we don't train on your data" to trust. Turn the Wi-Fi off and it still works.
- **No per-document fee.** After the one-time fine-tune, the thousandth deed costs electricity.
- **Nobody can deprecate it.** The base model, the adapter and the code sit on disk. A better open model means a training run, not a migration.
- **I could look inside.** The varas failure, the confidence result and the label quirk are in this post because I could inspect every output.

The honest limit: open models need a computer that can run them. An 8B model in 4-bit fits in about 5 GB.

## My Agent Session

I built this with Claude Code as a pair, and I want the log to be honest, including where it went wrong.

- It **read Tinker's docs first** instead of guessing the API, and wrote tests for the closure math before any model touched anything.
- The baseline exposed a hole in my design: many of the base model's *landmark names* were wrong, and closure can't see that. Those would all have been silent errors. That's why the per-sentence grounding check exists.
- It caught its own validator bugs by running the validator on the generator's *ground truth*, where a perfect model must produce zero flags. "Chains and links" parsing, "due north" with no number, and splitting on "running thence" each caused false flags until fixed.
- When varas failed, it **declined to keep patching the decoder** and ran the real fix as a proper experiment on fresh data.
- **Mistakes worth admitting:** it claimed the confidence floor was "tuned" when it never was (corrected in code and report). A banner said "Parcel closes" on a failed check. And in the first UI the map labels piled up on short sides and the "by hand" card was white text on a white background. I only noticed when I looked at my own screenshots.
- It kept a running cost log from the first job, with a guard that stops a job that would burn half the budget.

## The Lazy Payoff

Fifteen to thirty minutes of plotting becomes: **paste, glance at the map, approve.**

If the deed is clean, that's all. If it isn't, you don't get a confident wrong drawing. You get the line to look at, and usually the one-digit fix that closes the parcel. It's the laziest possible workflow with the one property a lazy workflow needs: **it fails loudly.**

## Prize Categories

**Best Use of Tinker.** Every part of the model work ran on Tinker: the LoRA fine-tune (pipelined forward/backward steps, per-epoch checkpoints), the baseline, the data-size learning curve, 4,250+ evaluated deeds, and the adapter download that makes the offline story possible. The final model cost **$1.15**; the whole project about **$3.80**.

The case in one line: **same base model, same prompt, same checks. The only change is the fine-tune, and it takes exact reads from 10% to 99.6% and silent errors from 5 of 60 to 2 of 3,000.** The cost story is the learning curve ($0.17 for 99.4%), a 3.8× smaller output format, a cache that makes re-evaluation free, and local inference that costs nothing. The limits are stated: synthetic data, a 0.24% upper bound, and a unit it had to be taught.

I'm not claiming other categories.
