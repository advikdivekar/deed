---
title: "10% to 99.6% for $1.15: the small AI that reads property deeds and refuses to bluff"
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

**N 86°29' E, 103.2 feet.**

One line from a property deed. Walk the rest of the lot and you should land back where you started.

You land **27 feet away.**

One digit is wrong. Maybe a clerk typed `103.2` for `130.2`. Maybe the scan smudged. Maybe the AI that read it got creative. The drawing still looks fine, and nobody finds out until the survey crew does.

I gave an open model, Qwen3-8B, three worked examples and 60 deeds. It read **6 exactly right (10%)**. In 5 of the other 54, it was wrong *and nothing flagged it*.

Then I spent **$1.15** fine-tuning it on Tinker. On 3,000 fresh deeds it reads **2,988 exactly right (99.6%)**. And when it can't, it says so.

{% embed https://youtu.be/S-m8AZUy7a8 %}

## TL;DR

- **What:** DeedReader turns a legal land description into a closed, plotted parcel on a real map. If the numbers don't add up, it refuses to draw it.
- **The Tinker result:** one LoRA on Qwen3-8B took exact reads from **10% (6/60) to 99.6% (2,988/3,000)**. On the *same* 60 deeds the fine-tune got all 60. Wrong-and-unflagged went from **5 to 0**.
- **The price:** **$1.15** for the final model, 3 epochs. **$0.17 of training already reaches 99.4%.** Whole project, evaluation included: about $3.80.
- **The rule:** the model only reads. Plain code closes the shape, finds the area, and runs six independent checks on every answer.
- **You own it:** I downloaded the 369 MB adapter and ran it offline. 150 of 150 deeds right, no network, no per-deed fee.

### 3 findings in 30 seconds

1. **Accuracy hides danger.** A model trained on 250 deeds scores 38.6%, but the scary number is that **19 wrong answers went unflagged**. At 500 deeds: 0.
2. **A model's confidence is not an alarm.** I swept the threshold from off to extreme. Nothing moved. It's exactly as sure when it's wrong.
3. **The cheapest optimization was the output format.** One line per call instead of JSON: **145 tokens instead of 547.** Every bill got 3.8× smaller.

![DeedReader plots a parcel on real satellite imagery. Click a sentence and its side lights up.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

## Why this matters: land is described in words

Every acre of land has a legal description written like this:

> *Beginning at an iron pin at the corner of Smith's lot, thence N 42°15' E 118.5 feet to a stone, thence S 88° E 200 feet along the creek, thence…*

Someone has to turn that into a drawing. Convert every bearing. Plot every side. Check it closes. Work out the acreage. **Fifteen to thirty minutes a deed**, and a single wrong digit poisons all of it.

### What's new here

| Option | What it gives you | What it can't tell you |
|---|---|---|
| Doing it by hand | A drawing you trust | It's 15–30 minutes a deed |
| A regex parser | Instant, free | Only reads clean `N 41°00' E` calls, not 1800s prose or numbers spelled out in words |
| A base open model, 3 examples in the prompt | Reads messy prose | **10% exactly right** in my test, and 5 of 60 wrong with no warning |
| **DeedReader** | A parcel on a real map in seconds | Says **NEEDS HUMAN REVIEW** when anything doesn't add up, and points at the line |

## What I Built

DeedReader does the lazy version: **paste, glance, approve.**

- The deed becomes a **parcel on a real satellite map**, with true bearings and distances
- **Acres, square feet, perimeter, closure ratio**, instantly
- Click any sentence and its side **lights up on the map**, and the other way round
- Export to **DXF** (CAD), **GeoJSON** (GIS) or **SVG**
- A deed that doesn't add up is **never drawn as if it did.** You get the line to check and the one-digit fix that would close it: `103.2 → 130.2`

For surveyors, title abstractors, paralegals, land agents, and anyone who has stared at a deed from 1893 and wished it came with a picture.

**Why it's a Slow and Steady project:** the tortoise didn't win by being fast. It won by never doing something stupid. Small model, **$1.15** of training, plain code for every number, and a system that would rather say "I don't know" than be quick and wrong.

## Demo

The video above is the whole tour. The studio replays **real recorded outputs of my fine-tuned model** on deeds it never saw in training, while every safety check runs **live in the browser**.

**Break it on purpose.** "Simulate a misread" corrupts one number. Three independent checks fail at once and it names the line:

![A misread caught: misclosure 900 ft, the number isn't in its clause, an independent reader disagrees](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/04-misread-caught.png)

**A real failure, left in.** This is an actual output from an early, untrained model. Wrong, and flagged instead of drawn:

![A real model failure, caught by the checks](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/05-zero-shot-flagged.png)

## Code

{% github advikdivekar/deed %}

## How I Built It

**The rule: the model reads, code decides.**

![The model reads. Code decides.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/architecture.png)

Language models read messy text brilliantly. They're not accountable for arithmetic. So Qwen3-8B + LoRA does one job, turning prose into structured calls. Everything else is plain, tested code. Six independent checks must agree before an answer may look confident:

1. It parses.
2. The parcel closes (1:5,000).
3. Every number appears **in its own sentence** of the deed.
4. Every landmark ("iron pin", "white oak") is backed by words in that sentence.
5. A **second, independent reader**, a regex parser that never saw the model, agrees on bearing, distance and curve direction.
6. The model's own confidence is above a floor.

**The data: truth first, prose second.** No free pile of labelled real deeds exists, so a generator draws a **closed polygon with known bearings and distances**, then writes it up in six styles, with easements and stray acreage as distractors. The truth exists before the text does, so every training label is exact. I held back one **writing style** (numbers spelled out) and one **unit** (varas) on purpose.

---

# Best Use of Tinker

## 10% → 99.6%, for $1.15

**Same base model. Same prompt. Same checks. The only thing that changed was one dollar and fifteen cents of Tinker training.**

![Deeds read exactly right, before and after](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/before_after.png)

My goal wasn't just a good number. It was **a good number at the lowest price I could defend.** Here's the recipe.

![The fine-tuning pipeline](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/finetune_pipeline.png)

### 1. Shrink the bill before you shrink the model

Tinker bills per token. My first output format was JSON: **547 tokens** per deed. So I designed one line per call:

```
POB iron pin
L N 41 0 0 E 121.9 ft | iron pin
C N 3 45 22 E 366.15 ft R 944.33 ft L | stone
```

Code converts it back to JSON. **145 tokens, 3.8× smaller**, which cuts training, evaluation and local inference at once. It costs nothing to run.

![3.8x fewer tokens](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/token_compaction.png)

### 2. Price the options, then pick

Training cost per million tokens: **Qwen3-8B $0.44**, Qwen3.5-4B $0.737. A smaller model isn't automatically a cheaper one. Qwen3-8B was cheaper to train and strong enough.

### 3. Train it (rank-32 LoRA, 3 epochs, 16 minutes)

```python
tc = await svc.create_lora_training_client_async(base_model="Qwen/Qwen3-8B", rank=32)

# loss only on the answer tokens, never on the deed prose
Datum(model_input=full[:-1],
      loss_fn_inputs=dict(weights=[0.0]*(len(prompt)-1) + [1.0]*len(completion),
                          target_tokens=full[1:]))

fb = await tc.forward_backward_async(batch, loss_fn="cross_entropy")
op = await tc.optim_step_async(AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
```

- **2,300 training deeds**, batch 16, peak LR 2e-4 with warmup and linear decay, **429 steps, about 2.6M tokens**
- **Loss masked to the completion**: it learns to write calls, not memorize deeds
- **Pipelined steps**: step *k+1* is submitted before step *k* returns
- **A checkpoint every epoch**, plus a **budget guard** that prices each job from token counts and refuses to launch one that would burn half the cap

The loss falls from 1,806 on step 1 to under 0.1 by step 41.

![Training loss across 3 epochs](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/training_loss.png)

### 4. Find the knee of the curve

Four runs, one epoch each, same 500 held-out deeds:

| training deeds | est. cost | read exactly right | wrong and unflagged |
|---|---|---|---|
| 250 | $0.04 | 38.6% | 19 |
| 500 | $0.08 | 92.6% | 0 |
| **1,000** | **$0.17** | **99.4%** | 0 |
| 2,000 | $0.34 | 99.6% | 0 |

![Accuracy per dollar](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/learning_curve.png)

**Seventeen cents buys 99.4%.** And at 250 deeds the model isn't just weak, it's *dangerous*.

### 5. Is the gain real or noise?

Paired on the **same 60 deeds**, deed by deed:

| | base, 3 examples in the prompt | fine-tuned |
|---|---|---|
| exactly right | **6 / 60** (10%, 95% CI 4.7–20.1%) | **60 / 60** |
| wrong and unflagged | 5 | 0 |
| deeds only this model got right | 0 | **54** |

Every deed the base model got right, the fine-tune also got right. Paired sign test: p < 0.0001.

On **3,000 fresh deeds** (generated before I froze the validator, scored once): **2,988 exactly right, 99.6%, 95% CI 99.3–99.8%.**

![Where all 3,000 deeds ended up](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/where_deeds_end_up.png)

Of the 12 wrong outputs, **10 were caught by parse and closure alone.** The other 2 are "wrong and unflagged" under my strictest labelling (0.07%, 95% upper bound 0.24%). Both are one ambiguity in my own generator: `87 links` written as "87 link" in one style and "0.87 chain" in another, the same physical length. By physical length the silent count is **0**. I report both.

### 6. Spend extra only where the eval says so

Held-out styles, first model:

| test | exactly right | flagged | wrong and unflagged |
|---|---|---|---|
| numbers spelled out | 85.6% | 14.4% | 0 |
| Texas varas | 20.8% | 79.2% | 0 |

Varas looked like a disaster, but the model read every number right. It wrote the unit as `var`, my decoder rejected it, and everything was flagged. **Zero wrong answers got through.**

I did *not* patch the decoder for each spelling the model improvised. That's overfitting the test. The fix was data: **150 spelled-out and 150 varas examples**, retrain, test on **fresh** deeds:

| fresh test set | n | exactly right | wrong and unflagged |
|---|---|---|---|
| in distribution | 3,000 | **99.6%** | 2 (0 by physical length) |
| spelled-out numbers | 250 | 99.6% | 0 |
| varas | 250 | 100% | 0 |

A new style or unit costs about 150 examples. It doesn't come free.

### 7. Test the alarm you're relying on

I expected the model's token probabilities to be a free early-warning system.

| confidence floor | flag rate | wrong and unflagged |
|---|---|---|
| off | 0.43% | 2 |
| -0.5 | 0.43% | 2 |
| -1.5 | 0.43% | 2 |
| -3.0 | 0.43% | 2 |

Nothing moved. So the real safety net is deterministic code, and I cut the claim from my plan.

### 8. Make evaluation free the second time

Evaluation was the bigger bill ($1.35 vs $2.46 for all training). So every sampled output is cached, and the checks score from the cache. Improving the validator and re-scoring 3,000 deeds cost **$0**. One deed through Tinker costs about **$0.0002**.

### 9. Rent the training. Keep the weights.

I downloaded the **369 MB adapter** and ran it with **MLX on the Apple GPU**, on a 4-bit Qwen3-8B base.

> **150 of 150 deeds read exactly right, 0 flagged, median 7.5 s per deed.** M3 Pro, 18 GB, no network, no API key.

### The whole bill

![Where the $3.80 went](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/cost_breakdown.png)

| item | est. cost |
|---|---|
| baseline, no training | $0.11 |
| learning-curve runs | $0.29 |
| first full run | $1.01 |
| **final model (2,300 deeds, 3 epochs)** | **$1.15** |
| all evaluation | $1.35 |
| **everything on Tinker** | **about $3.80** |

*Estimated from token counts at Tinker's list prices.*

---

## What went wrong

- **My validator flagged perfect answers.** I ran it on the generator's ground truth, where a perfect model must produce zero flags, and found three bugs ("chains and links", "due north", "running thence"). Each caused false alarms until fixed.
- **Two silent errors at 500 deeds** (a dropped arc-minute, a flipped curve direction) were invisible to closure. I added the independent second reader *after* seeing them, so I generated a fresh 3,000-deed set first, froze the validator, and scored once.
- **I once called the confidence floor "tuned."** It was never tuned. Corrected in the code, the report and this post.
- **My first screenshots had overlapping map labels** on short sides. I rebuilt the plot, then the whole view on a real map.

**Where the comparison flatters me:** the data is generated, so real recorded deeds are the next test. The baseline is a three-example prompt, not a heavily engineered one. And the answer key comes from my own generator, so its quirks count against the model.

## Why Does Open Innovation Matter?

A closed API gives you a prompt box. Open weights gave me a **steering wheel.**

- **I could change the model, not just the prompt.** Three examples got 10%. A one-dollar LoRA got 99.6%. You can't fine-tune, or download, a model you only rent.
- **Deeds are private.** They name people, parcels and mortgages. The weights run on the laptop that holds the file. Wi-Fi off, it still works.
- **No meter running.** After the one-time fine-tune, deed number one thousand costs electricity.
- **Nobody can deprecate it.** The base model, the adapter and the code sit on disk. A better open model next year is a training run, not a migration.
- **I could look inside.** Every finding above exists because I could inspect every output.

The honest caveat: training ran on Tinker's servers, on synthetic deeds only. At run time, nothing leaves the laptop.

## My Agent Session

I built DeedReader with Claude Code as a pair, from a written plan with a cost estimate up front and a budget guard on every training job.

- It **read Tinker's docs before writing a line against the API**, and wrote closure-math tests before any model touched the project.
- The baseline exposed a blind spot: many of the base model's *landmark names* were wrong, and closure can't see that. So it built the per-sentence grounding check.
- It debugged its own validator against ground truth, and when varas failed it ran the real fix as an experiment on fresh data instead of patching around it.
- It kept a running cost log from the first job.

## The Lazy Payoff

The usual route: read the deed, convert every bearing, protractor and scale, draw each leg, check the closure, compute the area. **Fifteen to thirty minutes.**

The DeedReader route: **paste, glance, approve.**

If the deed is clean, that's the whole job. If it isn't, you don't get a confident wrong drawing. You get the line to look at and, usually, the one-digit fix. It's the laziest workflow with the one property a lazy workflow needs: **it fails loudly.**

![By hand vs DeedReader](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/02-race.png)

## Prize Categories

**Best Use of Tinker.** The LoRA fine-tune (pipelined forward and backward passes, loss-masked completions, per-epoch checkpoints), the baseline, the data-size learning curve, more than 4,000 evaluated deeds, and the adapter download behind the offline story all ran on Tinker. **$1.15 for the final model, about $3.80 for the whole project.** Same base model, same prompt, same checks: exact reads went from **10% (6/60) to 99.6% (2,988/3,000)**, and every deed the base model got right, the fine-tune got right too.

*Built solo, with Claude Code.*

**Three epochs. $1.15. 10% became 99.6%.** If you think that's a good trade, a ❤️ or 🦄 helps more people find it.

What's the strangest phrase you've ever seen in a property deed? Mine so far is "to a white oak, thence along the run." Leave yours in the comments.
