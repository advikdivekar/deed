---
title: "10% to 99.6% for $1.15: the small AI that reads property deeds and refuses to bluff"
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

**N 86°29' E, 103.2 feet.**

That is one line of a property deed. Walk the rest of the lot and you should end up where you started.

You end up **27 feet away.**

One digit is wrong. Maybe a clerk typed `103.2` for `130.2`. Maybe the scan smudged. Maybe the AI that read it got creative. The drawing you'd make from it still looks fine, and nobody finds out until the survey crew does.

I had a generator draw 2,300 closed parcels with known answers, write each one up as a deed, and fine-tuned Qwen3-8B on them with Tinker for 3 epochs. On 3,000 fresh deeds the tuned model reads **2,988 exactly right (99.6%, 95% CI 99.3–99.8%)**. The same base model, with three worked examples in the prompt, read **6 of 60**. On those same 60 deeds the fine-tune got all 60, including every deed the base model got right (paired sign test, p < 0.0001). Training took 16 minutes and cost **$1.15**. The whole project, evaluation included, cost about $3.80.

This post is about land deeds. The idea in it is for anyone who has watched a language model sound sure and be wrong: **let the model read, let code decide, and measure the one number that matters, which is how often it is wrong and nobody notices.**

{% embed https://youtu.be/S-m8AZUy7a8 %}

## TL;DR

- **What:** DeedReader reads a metes-and-bounds land description, closes the parcel, works out the area, and plots it on a real satellite map. If the numbers don't close, it won't draw it. It stamps the result **NEEDS HUMAN REVIEW**, points at the line to check, and tries every single-digit fix to find the one that closes the shape.
- **The Tinker result:** one LoRA on Qwen3-8B moved exact reads from **10% (6/60) to 99.6% (2,988/3,000)**. Wrong-and-unflagged answers on the same 60 deeds went from **5 to 0**.
- **Cost:** **$1.15** for the final model. **$0.17 of training already reaches 99.4%.** One deed through Tinker costs about $0.0002.
- **Safety:** the model only reads. Plain code closes the shape, and six independent checks run on every answer. 10 of the 12 wrong outputs in the 3,000-deed run were caught by parsing and closure alone.
- **Honesty:** the deeds are generated, the baseline is a three-example prompt, and the two "silent" errors are a label quirk in my own generator. All three are in the tables below.
- **You own it:** I downloaded the 369 MB adapter and ran it offline. 150 of 150 deeds read exactly right on a laptop, with no network and no per-deed fee.

### 3 findings in 30 seconds

1. **Accuracy hides danger.** A model trained on 250 deeds scores 38.6%. The scary part is that **19 of its wrong answers were not flagged**. At 500 training deeds that number is 0, and that jump is where the model becomes safe to trust, not just better.
2. **A model's confidence is not an alarm.** I swept the confidence threshold from "off" to extreme, and the flag rate and the silent-error count did not move once. It is exactly as sure when it's wrong. The safety net has to be code.
3. **The cheapest optimization was the output format.** One line per call instead of JSON: **145 tokens instead of 547.** Every bill, training, evaluation and local inference, got 3.8× smaller from one design choice.

**Nothing private was sent anywhere.** Training used generated deeds only, so no real person's land record touched Tinker. The studio replays recorded model outputs and runs every check in your browser, and the model itself runs offline from the adapter on disk.

![DeedReader plots a parcel on real satellite imagery. Click a sentence and its side lights up.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

## Why this matters: land is described in words

Every parcel of land has a legal description, and it reads like this:

> *Commencing at a cedar post at the corner of Tract 7, thence S 46°30′11″ W 1,011.25 feet to a corner post, thence along a curve to the right, R = 757.19 feet, to a point in the center of the road, thence N 23°16′52″ W 1,206.14 feet to a 4 inch concrete monument…*

Somebody has to turn that into a drawing. Convert every bearing. Plot every side, including the curved ones. Check the shape closes. Work out the acreage. Typically **fifteen to thirty minutes a deed**, done by a surveyor, a title abstractor or a paralegal, and a single wrong digit quietly poisons all of it.

### What's new here

| Option | What it gives you | What it can't tell you |
|---|---|---|
| Doing it by hand | A drawing you trust | It takes 15–30 minutes a deed |
| A regex parser | Instant and free | Only reads clean `N 41°00' E` calls, not 1800s prose or numbers spelled out in words |
| A base open model, 3 examples in the prompt | Reads messy prose | **10% exactly right** in my test, and 5 of 60 wrong with no warning at all |
| **DeedReader** | A closed parcel on a real map in seconds | Says **NEEDS HUMAN REVIEW** when anything doesn't add up, and points at the line |

## What I Built

DeedReader is the lazy version of that job: **paste, glance, approve.**

- The deed becomes a **parcel on a real satellite map** with true bearings and distances
- **Acres, square feet, perimeter and closure ratio**, instantly
- Click a sentence and its side **lights up on the map**. Click a side and the sentence lights up
- Export to **DXF** for CAD, **GeoJSON** for GIS, or **SVG**
- A deed that doesn't add up is **never drawn as if it did.** You get the line to check and the one-digit fix that would close it, in the example above `103.2 → 130.2`

**Why it's a Slow and Steady project:** the tortoise didn't win by being fast. It won by never doing something stupid. A small model, **$1.15** of training, plain code for every number, and a system that would rather say "I don't know" than be quick and wrong. It automates the slowest job in land work, and it earns trust the slow way, by showing its arithmetic.

## Demo

The video above is the whole tour. The studio replays **real recorded outputs of my fine-tuned model** on deeds it never saw in training, while every safety check runs **live in the browser**.

**Break it on purpose.** "Simulate a misread" corrupts a single number. Three independent checks fail at once, the banner turns red, and it names the line:

![A misread caught: misclosure 900 ft, the number isn't in its clause, an independent reader disagrees](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/04-misread-caught.png)

**A real failure, left in.** This is an actual output from an early, untrained model. It was wrong, and it got flagged instead of drawn:

![A real model failure, caught by the checks](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/05-zero-shot-flagged.png)

## Code

{% github advikdivekar/deed %}

## How I Built It

**The rule behind all of it: the model reads, code decides.**

![The model reads. Code decides.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/architecture.png)

Language models read messy text brilliantly and are not accountable for arithmetic. So Qwen3-8B with a LoRA does exactly one job, turning prose into structured calls, and everything after that is plain, tested code: closure, area, unit conversion (feet, chains, poles, varas, links) and plotting. Then six independent checks have to agree before an answer is allowed to look confident:

1. The output parses.
2. The parcel closes (1:5,000).
3. Every number appears **in its own sentence** of the deed.
4. Every landmark ("iron pin", "white oak") is backed by words in that sentence.
5. A **second, independent reader**, a regex parser that never saw the model, agrees on bearing, distance and curve direction.
6. The model's own confidence is above a floor.

**The data: truth first, prose second.** There is no free pile of labelled real deeds, so I turned the problem around. A generator draws a **closed polygon with known bearings and distances**, then writes it up in many styles, with easements, deed-book references and stray acreage as distractors. The truth exists before the text does, so every training label is exact. I held back one **writing style** (every number spelled out in words) and one **unit** (Texas varas) on purpose, to see what the model does with things it has never met.

---

# Best Use of Tinker

## 10% → 99.6%, for $1.15

**Same base model. Same prompt. Same checks. The only thing that changed was one dollar and fifteen cents of Tinker training.**

![Deeds read exactly right, before and after](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/before_after.png)

My goal wasn't just a good number. It was **a good number at the lowest price I could defend.** Here is the recipe.

![The fine-tuning pipeline](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/finetune_pipeline.png)

### 1. Shrink the bill before you shrink the model

Tinker bills per token, so I started with the output. My first format was JSON, **547 tokens** per deed. I replaced it with one line per call:

```
POB iron pin
L N 41 0 0 E 121.9 ft | iron pin
C N 3 45 22 E 366.15 ft R 944.33 ft L | stone
```

Code converts it back to JSON. **145 tokens, 3.8× smaller**, which cuts training, evaluation and local inference at the same time. It costs nothing to run.

![3.8x fewer tokens](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/token_compaction.png)

### 2. Price the options, then pick

Training cost per million tokens: **Qwen3-8B $0.44**, Qwen3.5-4B $0.737. A smaller model is not automatically a cheaper one. Qwen3-8B was cheaper to train and strong enough for the job.

### 3. Train it: rank-32 LoRA, 3 epochs, 16 minutes

```python
tc = await svc.create_lora_training_client_async(base_model="Qwen/Qwen3-8B", rank=32)

# loss only on the answer tokens, never on the deed prose
Datum(model_input=full[:-1],
      loss_fn_inputs=dict(weights=[0.0]*(len(prompt)-1) + [1.0]*len(completion),
                          target_tokens=full[1:]))

fb = await tc.forward_backward_async(batch, loss_fn="cross_entropy")
op = await tc.optim_step_async(AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
```

**2,300 training deeds**, batch 16, peak learning rate 2e-4 with warmup and linear decay, **429 steps, about 2.6 million tokens.** The loss is masked to the answer, so the model learns to write calls instead of memorizing deed prose. Steps are pipelined, with step *k+1* submitted before step *k* returns, and a checkpoint is saved every epoch. A budget guard prices each job from token counts before submitting and refuses to launch one that would burn half the cap. The loss falls from 1,806 on step 1 to under 0.1 by step 41.

![Training loss across 3 epochs](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/training_loss.png)

### 4. Find the knee of the curve

I didn't train on everything and pray. Four runs, one epoch each, scored on the same 500 held-out deeds:

| training deeds | est. cost | read exactly right | wrong and unflagged |
|---|---|---|---|
| 250 | $0.04 | 38.6% | 19 |
| 500 | $0.08 | 92.6% | 0 |
| **1,000** | **$0.17** | **99.4%** | 0 |
| 2,000 | $0.34 | 99.6% | 0 |

![Accuracy per dollar](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/learning_curve.png)

**Seventeen cents buys 99.4%.** Everything after that is chasing the last 0.2%.

### 5. Is the gain real or noise?

The base model was scored on 60 deeds, so I paired it against the fine-tune on **the same 60**, deed by deed:

| | base, 3 examples in the prompt | fine-tuned |
|---|---|---|
| exactly right | **6 / 60** (10%, 95% CI 4.7–20.1%) | **60 / 60** |
| wrong and unflagged | 5 | 0 |
| deeds only this model got right | 0 | **54** |

Every deed the base model got right, the fine-tune also got right, and it won the other 54. Paired sign test: p < 0.0001.

On **3,000 fresh deeds**, generated before I froze the validator and scored exactly once, the fine-tune reads **2,988 exactly right: 99.6%, 95% CI 99.3–99.8%.**

![Where all 3,000 deeds ended up](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/where_deeds_end_up.png)

Of the 12 wrong outputs, **10 were caught by parse and closure alone.** The other 2 count as "wrong and unflagged" under my strictest labelling (0.07%, 95% upper bound 0.24%). Both are one ambiguity in my own generator: it writes `87 links` as "87 link" in one style and "0.87 chain" in another, which is the same physical length. By physical length the silent count is **0**. I report both numbers.

### 6. Spend extra only where the eval says so

My first full model, scored on the held-out style and unit:

| test | exactly right | flagged | wrong and unflagged |
|---|---|---|---|
| numbers spelled out | 85.6% | 14.4% | 0 |
| Texas varas | 20.8% | 79.2% | 0 |

Varas looked like a disaster. It wasn't. The model read every number correctly and wrote the unit as `var`, my decoder rejected it, and everything was flagged. **Zero wrong answers got through.**

I did not patch the decoder for each spelling the model improvised, because that is fitting the test set. The real fix was data: **150 spelled-out and 150 varas examples**, retrain, and score on **fresh** deeds:

| fresh test set | n | exactly right | wrong and unflagged |
|---|---|---|---|
| in distribution | 3,000 | **99.6%** | 2 (0 by physical length) |
| spelled-out numbers | 250 | 99.6% | 0 |
| varas | 250 | 100% | 0 |

A new style or unit costs about 150 examples. It does not come free.

### 7. Test the alarm you're relying on

I expected the model's token probabilities to be a free early-warning system. So I swept the floor:

| confidence floor | flag rate | wrong and unflagged |
|---|---|---|
| off | 0.43% | 2 |
| -0.5 | 0.43% | 2 |
| -1.5 | 0.43% | 2 |
| -3.0 | 0.43% | 2 |

Nothing moved. The real safety net is deterministic code, and I cut the claim from my plan.

### 8. Make evaluation free the second time

Evaluation was the bigger bill: **$1.35 against $2.46 for all training.** So every sampled output is cached, and the checks score from the cache. Improving the validator and re-scoring 3,000 deeds cost **$0**.

### 9. Rent the training. Keep the weights.

I downloaded the **369 MB adapter** and ran it with **MLX on the Apple GPU** on a 4-bit Qwen3-8B base.

> **150 of 150 deeds read exactly right, 0 flagged, median 7.5 seconds per deed.** M3 Pro, 18 GB, no network, no API key.

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

**My validator flagged perfect answers.** I ran it on the generator's own ground truth, where a perfect model must produce zero flags, and it raised false alarms anyway. Three bugs, all in how it read deeds: "chains and links" arithmetic, "due north" with no number, and splitting a sentence on "running thence". I fixed each before I trusted any score.

**Two silent errors slipped past closure.** At 500 deeds a dropped arc-minute and a flipped curve direction both produced a parcel that still closed. The independent second reader exists because of them. To keep the final number honest I added it, froze the validator, generated a fresh 3,000-deed set, and scored once.

**I once called the confidence floor "tuned."** It was never tuned. I corrected the code, the report and this post.

**My first screenshots had map labels piled on top of each other** on short sides. I rebuilt the plot, then rebuilt the whole view on a real map.

**Where the comparison flatters me:** the deeds are generated, so real recorded deeds are the next test. The baseline is a three-example prompt, not a heavily engineered one. And the answer key comes from my own generator, so its quirks count against the model, not for it.

## Why Does Open Innovation Matter?

A closed API gives you a prompt box. Open weights gave me a **steering wheel.**

**I could change the model, not just the prompt.** Three examples in a prompt got 10%. A one-dollar LoRA got 99.6%. You can't fine-tune a model you only rent, and you can't download what you trained.

**Deeds are private.** They name people, parcels and mortgages. The weights run on the laptop that holds the file. Turn Wi-Fi off and it still works. There is no "we don't train on your data" policy to trust, because there is nobody to send it to.

**No meter running.** After the one-time fine-tune, deed number one thousand costs electricity.

**Nobody can deprecate it.** The base model, the adapter and the code sit on disk. A better open model next year is a training run, not a migration.

**I could look inside.** Every finding above, the confidence result, the varas failure, the label tie, exists because I could inspect every output.

The honest caveat: training ran on Tinker's servers, on generated deeds only. At run time, nothing leaves the laptop.

## My Agent Session

I built DeedReader with Claude Code as a pair, from a written plan with a cost estimate up front and a budget guard on every training job.

- It **read Tinker's docs before writing a line against the API**, and wrote closure-math tests before any model touched the project.
- The baseline exposed a blind spot: many of the base model's *landmark names* were wrong, and closure can't see that. So it built the per-sentence grounding check.
- It debugged its own validator against ground truth, and when varas failed it ran the real fix as an experiment on fresh data instead of patching around it.
- It kept a running cost log from the first job.

## The Lazy Payoff

The usual route: read the deed, convert every bearing, protractor and scale, draw each leg, check the closure, compute the area. **Fifteen to thirty minutes.**

The DeedReader route: **paste, glance, approve.**

If the deed is clean, that's the whole job. If it isn't, you don't get a confident wrong drawing. You get the line to look at and, usually, the one-digit fix that closes the parcel. It's the laziest workflow with the one property a lazy workflow needs: **it fails loudly.**

![By hand vs DeedReader](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/02-race.png)

## Prize Categories

**Best Use of Tinker.** The LoRA fine-tune (pipelined forward and backward passes, loss-masked completions, per-epoch checkpoints), the baseline, the data-size learning curve, more than 4,000 evaluated deeds, and the adapter download behind the offline story all ran on Tinker. **$1.15 for the final model, about $3.80 for the whole project.** Same base model, same prompt, same checks: exact reads went from **10% (6/60) to 99.6% (2,988/3,000)**, and every deed the base model got right, the fine-tune got right too.

*Built solo, with Claude Code.*

**Three epochs. $1.15. 10% became 99.6%.** If you think that's a good trade, a ❤️ or 🦄 helps more people find it.

What's the strangest phrase you've ever seen in a property deed? Mine so far is "to a white oak, thence along the run." Leave yours in the comments.
