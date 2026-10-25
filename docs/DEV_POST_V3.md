---
title: "What if a $1.15 fine-tune could read any property deed, and refuse to guess when it can't?"
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

Every piece of land has a legal description, and it reads like this:

> *thence S 46°30′11″ W 1,011.25 feet to a corner post, thence along a curve to the right, R = 757.19 feet, to a point in the center of the road, thence N 23°16′52″ W 1,206.14 feet to a 4 inch concrete monument…*

Someone has to turn that paragraph into a drawing: convert every bearing, plot every side, check the shape closes, work out the acreage. It takes **15 to 30 minutes a deed**, and one wrong digit quietly poisons all of it. The drawing still looks fine. Nobody finds out until the survey crew does.

I wanted a tool that does the slow part in seconds and, more importantly, **tells you exactly which line to check** when something is off.

So I built **DeedReader**: paste a deed, get a closed parcel on a real satellite map in seconds. And if the numbers don't close, it won't draw it. It says **NEEDS HUMAN REVIEW**, points at the line, and finds the one-digit fix.

{% embed https://youtu.be/S-m8AZUy7a8 %}

## The result up front

![DeedReader plots a parcel on real satellite imagery. Click a sentence and its side lights up.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

- **10% → 99.6%.** One Tinker LoRA on Qwen3-8B took exact deed reads from 6/60 to **2,988/3,000** on fresh deeds.
- **$1.15** and 16 minutes of training. **$0.17 already reaches 99.4%.** The whole project cost about **$3.80**.
- **Wrong-and-unflagged answers on the same 60 deeds: 5 → 0.**
- **Runs offline.** 150 of 150 deeds read exactly right on a laptop with no network.

## What I Built

- A pasted deed becomes a **parcel on a real satellite map**, with acres, square feet, perimeter and closure ratio
- Click a sentence and its side **lights up on the map**, and the other way round
- **Export** to DXF (CAD), GeoJSON (GIS) or SVG
- A deed that doesn't close is **never drawn as if it did**. You get the line to check and the fix that would close it, e.g. `103.2 → 130.2`
- **Fully offline** from a downloaded adapter. Deeds name people, parcels and mortgages, and they never leave your machine

**How to use it:** paste the deed, glance at the map, approve. If it's clean, that's the whole job.

## Demo

**Break it on purpose.** "Simulate a misread" corrupts one number. Three independent checks fail at once, the banner goes red, and it names the line:

![A misread caught](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/04-misread-caught.png)

**By hand vs DeedReader:**

![By hand vs DeedReader](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/02-race.png)

**An early model's real mistake, caught instead of drawn:**

![A real model failure, caught by the checks](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/05-zero-shot-flagged.png)

## Code

{% github advikdivekar/deed %}

## How I Built It

**The rule: the model reads, code decides.**

![The model reads. Code decides.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/architecture.png)

Qwen3-8B plus a LoRA does exactly one job: turning deed prose into structured calls. Closure, area, unit conversion and plotting are plain, tested code. Then six independent checks must agree before an answer may look confident: it parses, the parcel closes, every number appears in its own sentence, every landmark is backed by words in that sentence, a second regex reader that never saw the model agrees, and the model's confidence clears a floor.

**Truth first, prose second.** A generator draws a closed polygon with known bearings and distances, then writes it up in six styles (symbols, dashes, words, archaic chains and links, damaged OCR) with distractor numbers mixed in. Every training label is exact. I held back one writing style (numbers spelled out) and one unit (Texas varas) to test the unfamiliar.

## Why Does Open Innovation Matter?

1. **I could change the model, not just the prompt.** Three examples in a prompt got 10%. A one-dollar LoRA got 99.6%.
2. **Deeds are private.** The weights run on the laptop that holds the file. Wi-Fi off, it still works.
3. **No meter running.** After the one-time fine-tune, deed number one thousand costs electricity.
4. **Nobody can deprecate it.** Base model, adapter and code sit on disk.
5. **I could look inside.** Every finding below exists because I could inspect every output.

*The honest limit:* training ran on Tinker's servers, on generated deeds only. No real land record was sent anywhere.

## My Agent Session

I built this with Claude Code as a pair, from a written plan with a cost estimate and a budget guard on every training job. It read Tinker's docs before touching the API, wrote the closure-math tests before any model existed, built the per-sentence landmark check after the baseline showed closure can't see wrong names, and kept a cost log from the first job.

## Prize Categories

### Best Use of Tinker

**What I used it for.** The baseline, a pipelined rank-32 LoRA fine-tune of Qwen3-8B (2,300 deeds, 3 epochs, 429 steps, loss masked to the answer), a data-size learning curve, 4,000+ evaluated deeds, and the adapter download behind the offline demo.

**Why.** I wanted a good number at the lowest price I could defend, so every step was about spending less per point of accuracy.

![The fine-tuning pipeline](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/finetune_pipeline.png)

**Results.** Same base model, same prompt, same checks:

| | base Qwen3-8B, 3 examples | **Tinker LoRA** |
|---|---|---|
| Exactly right | 6 / 60 (10%) | **2,988 / 3,000 (99.6%)** |
| Sent to a human | 82% | **0.4%** |
| Wrong and unflagged | 5 / 60 | **2 / 3,000 (0 by physical length)** |
| Training cost | n/a | **$1.15** |

![Deeds read exactly right, before and after](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/before_after.png)

And here is how the dollars were spent:

- **A 3.8× smaller bill from the output format.** One line per call instead of JSON: **145 tokens instead of 547**, which shrinks training, evaluation and local inference at once.
- **Price before picking.** Qwen3-8B trains at $0.44/M tokens vs $0.737 for Qwen3.5-4B, so the bigger model was the cheaper one.
- **The knee of the curve.** 250 deeds: 38.6% for $0.04. 500: 92.6% for $0.08. **1,000: 99.4% for $0.17.** From 500 deeds up, silent mistakes dropped to zero.
- **Paired, not cherry-picked.** On the same 60 deeds, the fine-tune got every deed the base got right, plus 54 more (sign test p < 0.0001).
- **Fresh exam.** 3,000 new deeds, generated before I froze the validator, scored once: **99.6%** (95% CI 99.3–99.8%). 10 of the 12 imperfect outputs were caught by parsing and closure alone.
- **New styles are a 150-example job.** Spelled-out numbers: 99.6%. Texas varas: **100%**. Both with 0 wrong-and-unflagged.
- **Evaluation for free the second time.** Every sampled output is cached, so re-scoring 3,000 deeds after a validator change cost **$0**. Per deed on Tinker: about $0.00015.
- **Rent the training, keep the weights.** The 369 MB adapter on a 4-bit base via MLX: **150/150 exactly right, median 7.5 s per deed**, M3 Pro, no network.

![Accuracy per dollar](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/learning_curve.png)

![Where the $3.80 went](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/cost_breakdown.png)

**Limits I'm stating on purpose.** The deeds are generated, which is what made exact labels and a 3,000-deed fresh test possible, so real recorded deeds are the next test and every real answer still ends in a human approve. The baseline is a 3-example prompt scored on 60 deeds to keep the bill low, which is why I paired it and gave its confidence interval. The 2 strict "silent" cases are one quirk in my generator (`87 links` written as "87 link" or "0.87 chain", same length). Curves are chord-form, and a new unit or style needs about 150 examples before the model uses it with confidence. It's a drafting aid, not a replacement for a licensed surveyor.

**What I learned.** The model's confidence is not an alarm: I swept the floor from off to extreme and nothing moved, because it is as sure when it's wrong. So the safety net is code. And the real milestone isn't accuracy, it's the moment silent errors hit zero, which here happens at 500 training deeds and about eight cents.

---

**Total Tinker spend: about $3.80. Final model: $1.15. 10% became 99.6%.**

What's the strangest phrase you've seen in a property deed? Mine so far is "to a white oak, thence along the run." Tell me yours in the comments, and if the trade looks good to you, a ❤️ or 🦄 helps.

*Built solo, with Claude Code.*
