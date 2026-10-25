---
title: "A small, not-so-smart model went from 10% to 99.6% at reading property deeds for $1.15, and it says 'check this line' instead of bluffing"
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

**N 86°29' E, 103.2 feet.**

That is one line of a property deed. Walk the rest of the lot and you should end up where you started.

You end up **27 feet away.**

One digit is wrong. Maybe a clerk typed `103.2` for `130.2`. Maybe the scan smudged. Maybe the AI that read it got creative. The drawing you'd make still looks fine, and nobody finds out until the survey crew does.

**DeedReader** reads that deed, closes the shape in plain code, plots it on a real satellite map, and when something doesn't add up it refuses to draw it. It stamps the result **NEEDS HUMAN REVIEW**, points at the line, and tries every one-digit fix to find the one that closes the parcel. In the example above: `103.2 → 130.2`.

{% embed https://youtu.be/S-m8AZUy7a8 %}

## TL;DR

- **The result:** one Tinker LoRA on Qwen3-8B moved exact deed reads from **10% (6/60)** to **99.6% (2,988/3,000, 95% CI 99.3–99.8%)** on fresh deeds. Same base model, same prompt, same checks.
- **The cost:** **$1.15** and 16 minutes of training for the final model. **$0.17 of training already reaches 99.4%.** The entire project, every baseline and every evaluation included, came to about **$3.80**.
- **The safety record:** on the same 60 deeds, wrong-and-unflagged answers went from **5 to 0**. Across 3,000 fresh deeds, 10 of the 12 imperfect outputs were caught by parsing and closure alone, and the other 2 are a label quirk in my own generator (same physical length, written two ways).
- **The design rule:** the model reads. Plain, tested code does every piece of math. Five independent checks must agree before an answer is allowed to look confident.
- **You keep it:** I downloaded the 369 MB adapter and ran it offline on a laptop. **150 of 150 deeds read exactly right**, no network, no per-deed fee.

![DeedReader plots a parcel on real satellite imagery. Click a sentence and its side lights up.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

## The problem: land is described in words

Every parcel of land has a legal description, and it reads like this:

> *Commencing at a cedar post at the corner of Tract 7, thence S 46°30′11″ W 1,011.25 feet to a corner post, thence along a curve to the right, R = 757.19 feet, to a point in the center of the road, thence N 23°16′52″ W 1,206.14 feet to a 4 inch concrete monument…*

Someone has to turn that into a drawing. Convert every bearing. Plot every side, curved ones included. Check the shape closes. Work out the acreage. That someone is a surveyor, a title abstractor or a paralegal, and the job takes **fifteen to thirty minutes a deed**.

The scary part isn't the time. It's that **one wrong digit quietly poisons everything downstream**, and the drawing still looks plausible. The failure you have to fear isn't "the tool is wrong." It's "the tool is wrong and didn't tell me."

## What exists today, and the gap

| Option | What it gives you | What it can't tell you |
|---|---|---|
| By hand | A drawing you trust | It takes 15–30 minutes a deed |
| A regex parser | Instant and free | Only reads clean `N 41°00' E` calls, not 1800s prose or numbers spelled out in words |
| A base open model, no training | Reads messy prose | **10% exactly right** in my test, and 5 of 60 wrong with no warning at all |
| **DeedReader** | A closed parcel on a real map in seconds | Says **NEEDS HUMAN REVIEW** when anything doesn't add up, and points at the line |

## What I built

DeedReader is the lazy version of that job: **paste, glance, approve.**

- The deed becomes a **parcel on a real satellite map** with true bearings and distances
- **Acres, square feet, perimeter and closure ratio**, instantly
- Click a sentence and its side **lights up on the map**. Click a side and the sentence lights up
- Export to **DXF** for CAD, **GeoJSON** for GIS, or **SVG**
- A deed that doesn't add up is **never drawn as if it did.** You get the line to check and the one-digit fix that would close it
- Works **fully offline** from a downloaded adapter

**Why it fits Slow and Steady:** the tortoise didn't win by being fast. It won by never doing something stupid. A small model, a dollar of training, plain code for every number, and a system that would rather say "I don't know" than be quick and wrong. It automates the slowest job in land work, and earns trust the slow way: by showing its arithmetic.

## Demo

The video above is the whole tour. The studio replays **real recorded outputs of my fine-tuned model** on deeds it never saw in training, while every safety check runs **live in your browser**.

**Paste, glance, approve.** A clean deed: every check passes, the parcel closes to 1:2.9 million, and the studio reports 43.44 acres. Click any sentence and its side lights up in the drawing. Export to SVG, DXF or GeoJSON in one click.

![All checks pass: a closed 8-sided parcel with two curves, 43.44 acres, ready to export](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03b-studio-drawing.png)

**Break it on purpose.** "Simulate a misread" corrupts a single number. Three independent checks fail at once, the banner turns red, and it names the line:

![A misread caught: misclosure 900 ft, the number isn't in its clause, an independent reader disagrees](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/04-misread-caught.png)

And the lazy payoff, side by side:

![By hand vs DeedReader](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/02-race.png)

## Code

{% github advikdivekar/deed %}

## How I built it

**The rule behind all of it: the model reads, code decides.**

![The model reads. Code decides.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/architecture.png)

Language models read messy text brilliantly and are not accountable for arithmetic. So Qwen3-8B plus a LoRA does exactly one job, turning prose into structured calls. Everything after that is plain code with tests: closure, area, unit conversion (feet, chains, poles, varas, links) and plotting.

Then five independent checks have to agree before an answer may look confident:

1. The output parses.
2. The parcel closes (1:5,000).
3. Every number appears **in its own sentence** of the deed.
4. Every landmark ("iron pin", "white oak") is backed by words in that sentence.
5. A **second, independent reader**, a regex parser that never saw the model, agrees on bearing, distance and curve direction.

**The data: truth first, prose second.** There is no free pile of labelled real deeds, so I turned the problem around. A generator draws a **closed polygon with known bearings and distances**, then writes it up in many styles: symbols, dashes, words, archaic chains and links, and damaged OCR, with easements, deed-book numbers and stray acreage as distractors. The truth exists before the text does, so every label is exact. I deliberately held back one **writing style** (every number spelled out in words) and one **unit** (Texas varas) to see what the model does with things it has never met.

---

# Best Use of Tinker

## 10% → 99.6%, for $1.15

**Qwen3-8B is a small model. Out of the box it doesn't know what a deed is, and it has nowhere near the knowledge of a giant LLM. It scored 10%. Same model, same prompt, same checks: the only thing that changed was one dollar and fifteen cents of Tinker training.**

That's the point. I didn't need a model that knows everything. I needed one that does one narrow job perfectly, and fine-tuning is how a small model gets there.

![Deeds read exactly right, before and after](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/before_after.png)

| | base Qwen3-8B, untrained | **Tinker LoRA** |
|---|---|---|
| Exactly right | 6 / 60 (10%) | **2,988 / 3,000 (99.6%)** |
| Sent to a human | 82% | **0.4%** |
| Wrong and unflagged | 5 / 60 | **2 / 3,000 (0 by physical length)** |
| Cost | n/a | **$1.15** |

My goal wasn't a good number. It was **a good number at the lowest price I could defend.** Here is exactly how.

![The fine-tuning pipeline](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/finetune_pipeline.png)

### 1. Shrink the bill before you shrink the model

Tinker bills per token, so I started with the output. My first format was JSON at **547 tokens** per deed. I replaced it with one line per call:

```
POB iron pin
L N 41 0 0 E 121.9 ft | iron pin
C N 3 45 22 E 366.15 ft R 944.33 ft L | stone
```

Code converts it back to JSON. **145 tokens, 3.8× smaller**, which cuts training, evaluation and local inference all at once, and costs nothing to run.

![3.8x fewer tokens](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/token_compaction.png)

### 2. Price the options, then pick

Training per million tokens: **Qwen3-8B $0.44** vs Qwen3.5-4B $0.737. A smaller model is not automatically a cheaper one. Qwen3-8B was cheaper to train and strong enough for the job.

### 3. Train: rank-32 LoRA, 3 epochs, 16 minutes

```python
tc = await svc.create_lora_training_client_async(base_model="Qwen/Qwen3-8B", rank=32)

# loss only on the answer tokens, never on the deed prose
Datum(model_input=full[:-1],
      loss_fn_inputs=dict(weights=[0.0]*(len(prompt)-1) + [1.0]*len(completion),
                          target_tokens=full[1:]))

fb = await tc.forward_backward_async(batch, loss_fn="cross_entropy")
op = await tc.optim_step_async(AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
```

**2,300 training deeds**, batch 16, peak learning rate 2e-4 with warmup and linear decay, **429 steps, about 2.6M tokens.** Loss is masked to the answer, so the model learns to write calls instead of memorizing deed prose. Steps are pipelined (step *k+1* is submitted before step *k* returns), a checkpoint is saved every epoch, and a budget guard prices every job from token counts and refuses to launch one that would burn half the cap. Loss falls from 1,806 on step 1 to under 0.1 by step 41.

![Training loss across 3 epochs](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/training_loss.png)

### 4. Find the knee of the curve

I didn't train on everything and hope. Four runs, one epoch each, scored on the same 500 held-out deeds:

| training deeds | est. cost | read exactly right | wrong and unflagged |
|---|---|---|---|
| 250 | $0.04 | 38.6% | 19 |
| 500 | $0.08 | 92.6% | **0** |
| **1,000** | **$0.17** | **99.4%** | **0** |
| 2,000 | $0.34 | 99.6% | 0 |

![Accuracy per dollar](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/learning_curve.png)

**Seventeen cents buys 99.4%.** And look at the zeros: between 250 and 500 deeds the model stops making *silent* mistakes. That jump, not the accuracy, is where it becomes safe to trust.

### 5. Is the gain real or noise?

I paired the base model against the fine-tune on **the same 60 deeds**, deed by deed:

| | base, untrained | fine-tuned |
|---|---|---|
| exactly right | 6 / 60 (10%, CI 4.7–20.1%) | **60 / 60** |
| wrong and unflagged | 5 | **0** |
| deeds only this model got right | 0 | **54** |

Every deed the base model got right, the fine-tune also got right, and it won the other 54. Paired sign test: **p < 0.0001.**

Then the real exam: **3,000 fresh deeds**, generated before I froze the validator and scored exactly once. **2,988 exactly right. 99.6%.**

![Where all 3,000 deeds ended up](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/where_deeds_end_up.png)

Of the 12 imperfect outputs, **10 were caught by parse and closure alone.** The other 2 are one ambiguity in my own generator: it writes `87 links` as "87 link" in one style and "0.87 chain" in another, which is the same physical length. By physical length, the silent count is **0**. I report both.

### 6. New styles and units cost about 150 examples

Held out on purpose, zero-shot, from the first model:

| unseen test | exactly right | wrong and unflagged |
|---|---|---|
| numbers spelled out in words | 85.6% | **0** (14.4% flagged for review) |
| Texas varas | every deed flagged | **0** |

Varas is the fun one. The model read every bearing and distance correctly but wrote the unit as `var`, a token it had never seen, and the strict decoder rejected it. So **everything was flagged and nothing wrong got through.** That is the safety net doing its job on a surprise.

I didn't patch the decoder to accept each spelling the model improvised, because that would be fitting the test set. The real fix was data: **150 examples each**, retrain, score on **fresh** deeds:

| fresh test set | n | exactly right | wrong and unflagged |
|---|---|---|---|
| in distribution | 3,000 | **99.6%** | 2 (0 by physical length) |
| spelled-out numbers | 250 | **99.6%** | 0 |
| varas | 250 | **100%** | 0 |

Onboarding a new style or unit is a 150-example, sub-dollar job. That's the workflow Tinker makes cheap enough to just do.

### 7. Make evaluation free the second time

Evaluation was the bigger bill (**$1.35** vs $2.46 for all training), so every sampled output is cached and the checks score from the cache. Improving the validator and re-scoring 3,000 deeds cost **$0.** One deed through Tinker costs about **$0.00015.**

### 8. Rent the training. Keep the weights.

I downloaded the **369 MB adapter** and ran it with **MLX on the Apple GPU** over a 4-bit Qwen3-8B base:

> **150 of 150 deeds read exactly right, 0 flagged, median 7.5 s per deed.** M3 Pro, 18 GB, no network, no API key.

### The whole bill

![Where the $3.80 went](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/cost_breakdown.png)

| item | est. cost |
|---|---|
| baseline, no training | $0.11 |
| learning-curve runs | $0.29 |
| first full run | $1.01 |
| **final model (2,300 deeds, 3 epochs)** | **$1.15** |
| all evaluation (4,000+ deeds) | $1.35 |
| **everything on Tinker** | **about $3.80** |

*Estimated from token counts at Tinker's list prices.*

---

## Known edges (measured, not hidden)

I'd rather you hear these from me, with numbers.

- **The deeds are generated.** That's what made exact labels and a 3,000-deed fresh test possible, and it's why the held-out style and unit matter. The next step is running real recorded deeds through the same pipeline, which is why every real-world answer still ends in a human approve button.
- **The baseline is the plain base model**, not a heavily engineered one, and it was scored on 60 deeds to keep the bill low. That's why I paired it against the fine-tune on the same 60 and gave its confidence interval.
- **Clause checks look for `;` or `thence`** between calls. Where that structure is missing, they fall back to whole-text checks.
- **Curves are chord-form** (chord bearing, length, radius, direction). Deflection angles and station/offset descriptions aren't supported yet.
- **It's a drafting aid.** Not a substitute for a licensed surveyor.

**What went wrong on the way (and made it better):** my validator flagged *perfect* answers until I ran it on the generator's own ground truth and fixed three reading bugs. Two silent errors slipped past closure at 500 deeds (a dropped arc-minute and a flipped curve direction), which is exactly why the independent second reader exists.

## Why does open innovation matter?

A closed API gives you a prompt box. Open weights gave me a **steering wheel.**

- **I could change the model, not just the prompt.** The untrained small model got 10%. A one-dollar LoRA got 99.6%.
- **Deeds are private.** They name people, parcels and mortgages. The weights run on the laptop that holds the file. Turn Wi-Fi off and it still works.
- **No meter running.** After the one-time fine-tune, deed number one thousand costs electricity.
- **Nobody can deprecate it.** The base model, adapter and code sit on disk. A better open model next year is a training run, not a migration.
- **I could look inside.** The varas failure and the label tie all exist because I could inspect every output.

The honest caveat: training ran on Tinker's servers on generated deeds only. No real person's land record was ever sent anywhere, and at run time nothing leaves the laptop.

## My agent session

I built DeedReader with Claude Code as a pair, from a written plan with a cost estimate up front and a budget guard on every training job.

- It read Tinker's docs before writing a line against the API, and wrote closure-math tests before any model touched the project.
- The baseline exposed a blind spot: many of the base model's *landmark names* were wrong, and closure can't see that. So it built the per-sentence grounding check.
- It debugged its own validator against ground truth, and when varas failed it ran the real fix as an experiment on fresh data instead of patching around it.
- It kept a running cost log from the first job.

## Prize categories

**Best Use of Tinker.** The LoRA fine-tune (pipelined forward/backward passes, loss-masked completions, per-epoch checkpoints), the baseline, the data-size learning curve, 4,000+ evaluated deeds and the adapter download behind the offline story all ran on Tinker. **$1.15 for the final model, about $3.80 for everything.** Same base model, same prompt, same checks: **10% (6/60) → 99.6% (2,988/3,000)**, and every deed the base model got right, the fine-tune got right too.

*Built solo, with Claude Code.*

**Three epochs. $1.15. 10% became 99.6%.** If that sounds like a good trade, a ❤️ or 🦄 helps more people find it.

What's the strangest phrase you've ever seen in a property deed? Mine so far is "to a white oak, thence along the run." Leave yours in the comments.
