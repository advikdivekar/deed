---
title: "10% to 99.6% for $1.15: the small AI that reads property deeds and refuses to bluff"
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

**N 86°29' E, 103.2 feet.**

That's one line of a property deed. Walk the rest of the lot's edges and you're supposed to arrive back where you started. You arrive **27 feet away.**

One digit is wrong. Maybe the clerk typed `103.2` for `130.2`. Maybe the scan smudged. Maybe the AI that read it got creative. Whatever the cause, the drawing you'd make from it looks completely fine, and nobody finds out until the survey crew does.

So I handed deeds to an open-weight model, Qwen3-8B, with three worked examples in the prompt. On 60 deeds it read **6 exactly right (10%)**. In 5 of the 60 the answer was wrong *and nothing about it looked wrong*.

Then I spent **$1.15** fine-tuning it on Tinker. On 3,000 fresh deeds it reads **2,988 exactly right (99.6%)**, and when it can't, it says so.

{% embed https://youtu.be/S-m8AZUy7a8 %}

## TL;DR

- **What:** DeedReader turns a legal land description into a closed, plotted parcel on a real map, and refuses to draw one that doesn't add up.
- **The Tinker result:** one LoRA on Qwen3-8B took exact reads from **10% (6/60) to 99.6% (2,988/3,000)**. On the *same* 60 deeds the fine-tune got all 60 right, and every deed the base model got right, it also got right. Wrong-and-unflagged answers went from **5 of 60 to 0**.
- **The price:** $1.15 for the final model. **$0.17 of training already reaches 99.4%.** The whole project, evaluation included, cost about $3.80.
- **The design rule:** the model only reads. Plain code closes the shape, finds the area, and runs six independent checks on every answer.
- **You own it:** I downloaded the 369 MB adapter and ran it offline on a laptop. 150 of 150 deeds read exactly right, no network, no per-deed fee.

### 4 findings in 30 seconds

1. **Accuracy hides danger.** A model trained on 250 deeds scores 38.6%, but the real problem is that **19 of its wrong answers were not flagged**. At 500 deeds that number drops to 0.
2. **The model's confidence is useless as an alarm.** I swept the threshold from "off" to extreme. The flag rate and the silent-error count did not move once. It is just as sure when it's wrong.
3. **A brand-new unit or style costs about 150 examples.** Numbers spelled out in words, or Texas *varas*, started at 85.6% and 20.8%. 150 examples of each took them to 99.6% and 100%.
4. **The cheapest optimization was the output format.** One line per call instead of JSON: **145 tokens instead of 547, 3.8× fewer**, on every bill.

![DeedReader plots a parcel on real satellite imagery. Click a sentence and its side lights up.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

## What I Built

Every acre of land in the world is described in words. Not coordinates, *words*:

> *Beginning at an iron pin at the corner of Smith's lot, thence N 42°15' E 118.5 feet to a stone, thence S 88° E 200 feet along the creek, thence…*

Turning that into a drawing is the slowest, dullest job in land work. Convert every bearing. Plot every side. Check the shape closes. Work out the acreage. **Fifteen to thirty minutes a deed**, and one wrong digit quietly poisons all of it.

DeedReader does it the lazy way: **paste, glance, approve.**

- The deed becomes a **parcel on a real satellite map** (or a clean survey drawing), with true bearings and distances
- **Acres, square feet, perimeter and closure ratio**, instantly
- Click any sentence and its side **lights up on the map**. Click a side and the sentence lights up
- Export to **DXF** for CAD, **GeoJSON** for GIS, **SVG** for everything else
- A deed that doesn't add up is **never drawn as if it did.** It's stamped **NEEDS HUMAN REVIEW**, with the exact line to look at and the single-digit fix that would close the parcel. In the example above: `103.2 → 130.2`

Who gets to be lazier? Surveyors, title abstractors, paralegals, land agents, anyone who has stared at a deed from 1893 and wished it came with a picture.

### Why this is a Slow and Steady project

The tortoise didn't win by being fast. It won by never doing something stupid. DeedReader is built from small, boring, steady parts: a small model instead of a giant one, **$1.15** of training instead of a GPU cluster, plain code for every number, and a system that would rather say "I don't know" than be quick and wrong. It automates the slowest job in land work, and it earns trust the slow way: by showing its arithmetic.

## Demo

The video above is the whole tour. The studio is a Next.js app that replays **real recorded outputs of my fine-tuned model** on deeds it never saw in training, while every safety check runs **live in the browser**. The model's output is the model's. The checks are real code.

**Pick a deed in any style:** modern legalese, surveyor shorthand, numbers spelled out ("five hundred forty and two tenths feet"), 1800s phrasing ("to a white oak, thence along the run"), Texas *varas*, a noisy scan.

**Now break it.** "Simulate a misread" corrupts a single number. Three independent checks fail at once, the banner turns red, and it names the guilty line and the fix:

![A misread caught: misclosure 900 ft, the number isn't in its clause, an independent reader disagrees](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/04-misread-caught.png)

**A real failure, left in on purpose.** This is an actual output from an early, untrained model. It was wrong. It got flagged instead of drawn:

![A real model failure, caught by the checks](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/05-zero-shot-flagged.png)

Prefer a survey drawing? Curves are real arcs, with true north and a scale bar:

![The drawing view](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03b-studio-drawing.png)

## Code

{% github advikdivekar/deed %}

## How I Built It

### One rule: the model reads, code decides

Language models read messy text brilliantly. They are not accountable for arithmetic. So I split the job along exactly that line:

![The model reads. Code decides.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/architecture.png)

- **Qwen3-8B + LoRA**, the only AI in the loop, turns prose into structured calls.
- **Plain, tested code** does closure, area, unit conversion (feet, chains, poles, varas, links) and plotting.
- **Six independent checks** must agree before any answer is allowed to look confident:
  1. the output parses
  2. the parcel closes (1:5,000)
  3. every number appears **in its own sentence** of the deed
  4. every landmark ("iron pin", "white oak") is backed by words in that sentence
  5. a **second, independent reader**, a regex parser that never saw the model, agrees on bearing, distance and curve direction
  6. the model's own confidence

When closure fails, DeedReader tries every single-field change (flip a quadrant, swap two digits) and reports the one that closes the parcel.

### The data: ground truth first, prose second

I couldn't get thousands of labelled real deeds for free, so I turned the problem upside down. A generator draws a **closed polygon with known bearings and distances**, then *writes it up* in six styles, with easements, deed-book references and stray acreage as distractors. Because the truth exists before the text does, every training label is exact.

I held back two things on purpose: one **writing style** (every number spelled out) and one **unit** (varas).

---

# Best Use of Tinker

## 10% → 99.6%, for $1.15

**The base model read 10% of deeds exactly right. The fine-tuned one reads 99.6%.** Same model, same prompt, same checks. The only thing that changed was **one dollar and fifteen cents of Tinker training.**

![Deeds read exactly right, before and after](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/before_after.png)

My brief wasn't just *good results*. It was **good results at the lowest price**, with a number I could defend. Here is how it was done.

![The fine-tuning pipeline](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/finetune_pipeline.png)

### 1. Price the options, then pick

Tinker publishes per-token prices, so the first filter is arithmetic. Training cost per million tokens: **Qwen3-8B $0.44**, Qwen3.5-4B $0.737. A smaller model isn't automatically a cheaper one. Qwen3-8B was cheaper to train and strong enough for the job.

### 2. Shrink the bill before you shrink the model

My first instinct was JSON output. A typical deed answer was **547 tokens**. So I designed a line-per-call format:

```
POB iron pin
L N 41 0 0 E 121.9 ft | iron pin
C N 3 45 22 E 366.15 ft R 944.33 ft L | stone
```

Code converts it back to JSON. **145 tokens, 3.8× smaller.** Tinker bills per token, so this one choice cuts training, evaluation and local inference cost at once, and costs nothing to run.

![3.8x fewer tokens](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/token_compaction.png)

### 3. The actual training setup

```python
tc = await svc.create_lora_training_client_async(base_model="Qwen/Qwen3-8B", rank=32)

# loss only on the answer tokens, never on the deed prose
Datum(model_input=full[:-1],
      loss_fn_inputs=dict(weights=[0.0]*(len(prompt)-1) + [1.0]*len(completion),
                          target_tokens=full[1:]))

fb = await tc.forward_backward_async(batch, loss_fn="cross_entropy")
op = await tc.optim_step_async(AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
```

- **LoRA rank 32**, batch size 16, peak learning rate 2e-4 with a 5-step warmup and linear decay to 10%
- **Loss masked to the completion**: the model learns to *write calls*, not to memorize deeds
- **Pipelined steps**: step *k+1* is submitted before step *k* returns, so the service never idles between round trips
- **A checkpoint every epoch** via `save_weights_for_sampler`, so epochs can be compared without retraining
- **A budget guard** that prices each job from token counts *before* submitting and refuses to launch one that would burn half the cap

**2,300 training deeds, 3 epochs, 429 steps, about 2.6 million tokens, 16 minutes.** The loss falls from 1,806 on step 1 to under 0.1 by step 41, inside the first third of the first epoch.

![Training loss across 3 epochs](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/training_loss.png)

### 4. Find the knee of the curve instead of guessing

I didn't train on everything and pray. Four runs, one epoch each, same 500 held-out deeds:

| training deeds | est. cost | read exactly right | wrong and unflagged |
|---|---|---|---|
| 250 | $0.04 | 38.6% | 19 |
| 500 | $0.08 | 92.6% | 0 |
| **1,000** | **$0.17** | **99.4%** | 0 |
| 2,000 | $0.34 | 99.6% | 0 |

![Accuracy per dollar](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/learning_curve.png)

**Seventeen cents buys 99.4%.** The curve also shows something accuracy alone hides: at 250 deeds the model isn't just weak, it's *dangerous*. The jump from 250 to 500 is where it becomes safe to trust.

### 5. Is the gain real or noise?

The base model was scored on 60 deeds, so I paired it against the fine-tune on **the same 60**, deed by deed:

| | base, 3 examples in the prompt | fine-tuned |
|---|---|---|
| exactly right (same 60 deeds) | **6 / 60** (10%, 95% CI 4.7–20.1%) | **60 / 60** |
| wrong and unflagged | 5 | 0 |
| deeds only this model got right | 0 | **54** |

Every deed the base model got right, the fine-tune also got right, and it won the other 54. The paired sign test gives p < 0.0001.

On 3,000 fresh deeds, generated before I froze the validator and scored once, the fine-tune reads **2,988 exactly right: 99.6%, 95% CI 99.3–99.8%.**

![Where all 3,000 deeds ended up](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/where_deeds_end_up.png)

Of the 12 wrong outputs, **10 were caught by parse and closure alone.** The remaining 2 are counted as "wrong and unflagged" under my strictest labelling (0.07%, 95% upper bound 0.24%). Both are the same ambiguity in my own generator: it writes `87 links` as "87 link" in one style and "0.87 chain" in another. The model's answer is the same physical length. By physical length the silent count is **0**. I report both.

### 6. Spend extra only where the eval says so

The first full model read my held-out *spelled-out* style at 85.6% exactly right and flagged the other 14.4%. On held-out *varas* it read every number correctly but wrote the unit as `var`, my decoder rejected it, and everything was flagged. Wrong answers nobody caught? **Zero.** The safety net held.

The fix wasn't to patch the decoder for every spelling the model improvised. That's overfitting to the test. The fix was data: **150 spelled-out and 150 varas examples**, retrain, test on **fresh** deeds.

| fresh test set | n | read exactly right | wrong and unflagged |
|---|---|---|---|
| in distribution | 3,000 | **99.6%** | 2 (0 by physical length) |
| spelled-out numbers | 250 | 99.6% | 0 |
| varas | 250 | 100% | 0 |

A new style or unit costs about 150 examples. It doesn't come for free.

### 7. Test the alarm you're relying on

I expected the model's own token probabilities to be a free early-warning system. I swept the confidence threshold from off to extreme:

| confidence floor | flag rate | wrong and unflagged |
|---|---|---|
| off | 0.43% | 2 |
| -0.5 | 0.43% | 2 |
| -1.5 | 0.43% | 2 |
| -3.0 | 0.43% | 2 |

Nothing moved. The model is just as confident when it's wrong. So the real safety net is deterministic code, and I cut the claim from my plan.

### 8. Make evaluation free the second time

Evaluation was the bigger bill ($1.35 against $2.46 for all training), so I made it repeatable for nothing. Every sampled output is cached by checkpoint and input, and the safety checks score from the cache. Improving the validator and re-scoring 3,000 deeds cost **$0**. At inference, one deed costs about **$0.0002** through Tinker.

### 9. Rent the training. Keep the weights.

The cheapest inference is the one you don't pay for. I downloaded the **369 MB LoRA adapter** and ran it with **MLX on the Apple GPU**: a 4-bit Qwen3-8B base with the adapter applied at run time.

> **150 of 150 deeds read exactly right, 0 flagged, median 7.5 seconds per deed.** M3 Pro, 18 GB, no network, no API key, no per-deed fee.

### The whole bill

![Where the $3.80 went](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/cost_breakdown.png)

| item | est. cost |
|---|---|
| baseline, no training | $0.11 |
| learning-curve runs (250 / 500 / 1,000) | $0.29 |
| first full run (2,000 deeds) | $1.01 |
| **final model (2,300 deeds, 3 epochs)** | **$1.15** |
| all evaluation | $1.35 |
| **everything on Tinker** | **about $3.80** |

*Estimated from token counts at Tinker's list prices.*

---

## What went wrong

- **My validator flagged perfect answers.** I ran it on the generator's own ground truth, where a perfect model must produce zero flags, and found three bugs: "chains and links" parsing, "due north" with no number, and splitting on "running thence". Each one raised false alarms until fixed.
- **The varas failure looked like a disaster.** 20.8% exactly right on a unit it had never seen, but the numbers were all correct. The model wrote `var`, not `varas`. I added the obvious plural and **refused to keep adding aliases**, because that's fitting the decoder to the test.
- **Two silent errors at 500 deeds** (a dropped arc-minute, a flipped curve direction) were invisible to closure. I added the independent second reader *after* seeing them, so I generated a fresh 3,000-deed set first, froze the validator, and evaluated once.
- **I once called the confidence floor "tuned."** It was never tuned. I corrected the code, the report and this post.
- **My first screenshots had overlapping map labels** on short sides. I rebuilt the plot, then rebuilt the whole view on a real map.

**Where the comparison flatters me:** the data is generated, so real recorded deeds are the next test. The baseline is a three-example prompt, not a heavily engineered one. And the answer key comes from my own generator, so its quirks count against the model.

## Why Does Open Innovation Matter?

A closed API would have given me a prompt box. Open weights gave me a **steering wheel.**

- **I could change the model, not just the prompt.** Three examples in a prompt got 10%. A one-dollar LoRA got 99.6%. You can't fine-tune a model you only rent, or download what you trained.
- **Deeds are private by nature.** They name people, parcels and mortgages. The weights run on the laptop that holds the file. Turn Wi-Fi off and it still works. There is no "we don't train on your data" policy to trust, because there's no one to send it to.
- **No meter running.** After the one-time fine-tune, the thousandth deed costs electricity.
- **Nobody can deprecate it.** The base model, the adapter and the code sit on disk. A better open model next year is a training run, not a migration.
- **I could look inside.** Every finding in this post, the confidence result, the varas failure, the label tie, exists because I could inspect every output.

The honest caveat: training ran on Tinker's servers, with synthetic deeds only. At run time, nothing leaves the laptop.

## My Agent Session

I built DeedReader with Claude Code as a pair, working to a written plan with a cost estimate up front and a budget guard on every training job.

- It **read Tinker's docs before writing a line against the API**, and wrote closure-math tests before any model touched the project.
- The baseline exposed a blind spot: many of the base model's *landmark names* were wrong, and closure can't see that. So it built the per-sentence grounding check. Those errors would have been silent.
- It debugged its own validator against the generator's **ground truth**, and when varas failed it ran the real fix as a proper experiment on fresh data instead of patching around it.
- It kept a running cost log from the first job, with a guard that stops any job that would burn half the budget.

## The Lazy Payoff

The usual route: read the deed, convert every bearing, protractor and scale, draw each leg, check the closure, compute the area. **Fifteen to thirty minutes.**

The DeedReader route: **paste, glance, approve.**

If the deed is clean, that's the whole job. If it isn't, you don't get a confident wrong drawing. You get the line to look at and, usually, the one-digit fix that closes the parcel. It's the laziest possible workflow with the single property a lazy workflow needs: **it fails loudly.**

![By hand vs DeedReader](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/02-race.png)

## Prize Categories

**Best Use of Tinker.** The LoRA fine-tune (pipelined forward and backward passes, loss-masked completions, per-epoch checkpoints), the baseline, the data-size learning curve, more than 4,000 evaluated deeds, and the adapter download behind the offline story all ran on Tinker. **$1.15 for the final model, about $3.80 for the whole project.** Same base model, same prompt, same checks, and the fine-tune alone took exact reads from **10% (6/60) to 99.6% (2,988/3,000)**, with every deed the base model got right also right in the fine-tune.

*Built solo, with Claude Code.*

**Three epochs. $1.15. 10% became 99.6%.** If you think that's a good trade, a ❤️ or 🦄 helps more people find it.

What's the strangest phrase you've ever seen in a property deed? Mine so far is "to a white oak, thence along the run." Leave yours in the comments.
