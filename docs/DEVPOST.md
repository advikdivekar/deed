---
title: "Slow, steady, and $1.15: the small AI that reads property deeds and refuses to bluff"
published: false
tags: devchallenge, hacktoberfest, ai, opensource
cover_image: https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 3: Slow and Steady](https://dev.to/challenges/hacktoberfest-week3-2026-10-19)*

**N 86°29' E, 103.2 feet.**

That's one line of a property deed. Walk the rest of the lot's edges and you're supposed to arrive back where you started. You arrive **27 feet away.**

One digit is wrong. Maybe the clerk typed `103.2` for `130.2`. Maybe the scan smudged. Maybe the AI that read it got creative. Whatever the cause, the drawing you'd make from it looks completely fine. Nobody finds out until it's a lawsuit about a driveway.

I built the tool that finds out in under a second. It's called **DeedReader**, and the interesting part isn't that it reads deeds. The interesting part is that **it knows when it hasn't.**

![DeedReader plots a parcel on real satellite imagery](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

## What I Built

Every acre of land in the world is described in words. Not coordinates, *words*:

> *Beginning at an iron pin at the corner of Smith's lot, thence N 42°15' E 118.5 feet to a stone, thence S 88° E 200 feet along the creek, thence…*

Turning that into a drawing is the slowest, dullest job in land work. Convert every bearing. Plot every side. Check the shape closes. Work out the acreage. **Fifteen to thirty minutes a deed**, and one wrong digit quietly poisons all of it.

DeedReader does it the lazy way. **Paste. Glance. Approve.**

- The deed becomes a **parcel on a real satellite map** (or a clean survey drawing), with true bearings and distances
- **Acres, square feet, perimeter, closure ratio**, instantly
- Click any sentence of the deed and its side **lights up on the map**. Click a side and the sentence lights up
- Export to **DXF** for CAD, **GeoJSON** for GIS, **SVG** for everything else
- And the part I'm proudest of: a deed that doesn't add up is **never drawn as if it did.** It's stamped **NEEDS HUMAN REVIEW**, with the exact line to look at and the single-digit fix that would close the parcel. In the example above: `103.2 → 130.2`

Who gets to be lazier? Surveyors, title abstractors, paralegals, land agents, anyone who has ever stared at a deed from 1893 and wished it came with a picture.

### Why this is a *Slow and Steady* project

The tortoise didn't win by being fast. It won by never doing something stupid.

That's the whole design. DeedReader is built from small, boring, steady parts:

- A **small** model (8B) instead of a giant one
- **$1.15** of training instead of a GPU cluster
- **Plain code** for every number instead of vibes
- A system that would rather say "I don't know" than be fast and wrong

Slow work, made steady, by a model that knows its place.

## Demo

> 🎬 **Demo video:** *(embedded here at publish)*

The studio is a Next.js app. It replays **real recorded outputs from my fine-tuned model**, on deeds it never saw in training, while every safety check runs **live in your browser**. The model's output is the model's. The checks are real code. Nothing here is mocked.

**Pick a deed. Any style.** Modern legalese, surveyor shorthand, numbers spelled out ("five hundred forty and two tenths feet"), 1800s phrasing ("to a white oak, thence along the run"), Texas *varas*, a noisy scan.

![Click a sentence, its side lights up](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03-studio-map.png)

**Prefer a drawing?** Real arcs for curves, true north, scale bar.

![The drawing view](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/03b-studio-drawing.png)

**Now break it.** "Simulate a misread" corrupts a single number. Watch three independent checks fail at once and name the guilty line:

![A misread caught by three separate checks](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/04-misread-caught.png)

**A real failure, left in on purpose.** This is an actual output from an early, untrained model. It was wrong. It got flagged instead of drawn.

![A real model failure, caught](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/05-zero-shot-flagged.png)

**And the lazy payoff, side by side:**

![By hand vs DeedReader](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/screens/02-race.png)

## Code

{% github advikdivekar/deed %}

`deedreader/` closure math and validator · `data/` synthetic deed generator · `train/` Tinker fine-tuning · `eval/` metrics and report · `app/web/` the Next.js studio · `offline/` run it with no internet · `tests/`

19 Python tests and 7 TypeScript tests. The in-browser validator is checked against the Python one on **5,490 cases with zero disagreements.** Every number in this post is computed from saved model outputs by `eval/report.py`, and every Tinker job is in `COST_LOG.md`.

## How I Built It

### One rule: the model reads, code decides

Language models are brilliant at reading messy text. They are not accountable for arithmetic. So I split the job exactly along that line:

![The model reads. Code decides.](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/architecture.png)

- **Qwen3-8B + LoRA**, the only AI in the loop, turns prose into structured calls.
- **Plain, tested code** does closure, area, unit conversion (feet, chains, poles, varas, links) and plotting.
- **Six independent checks** must agree before any result is allowed to look confident:
  1. the output parses
  2. the parcel closes (1:5,000)
  3. every number appears **in its own sentence** of the deed
  4. every landmark ("iron pin", "white oak") is backed by words in that sentence
  5. a **second, independent reader**, a regex parser that never saw the model, agrees on bearing, distance and curve direction
  6. the model's own confidence

When closure fails, DeedReader tries every single-field change (flip a quadrant, swap two digits) and reports the one that closes the parcel.

### The data: ground truth first, prose second

I couldn't get thousands of labelled real deeds for free, so I turned the problem upside down. A generator draws a **closed polygon with known bearings and distances**, then *writes it up* in six styles, with easements, deed-book references and stray acreage thrown in as distractors. Because the truth exists before the text does, every training label is exact.

I deliberately held back one **writing style** (every number spelled out) and one **unit** (varas), to see what the model would do with things it had never met.

---

# Best Use of Tinker: the engineering

The brief I gave myself: **the best result at the lowest price.** Every decision below serves that.

![The fine-tuning pipeline](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/finetune_pipeline.png)

## 1. Price the options, then pick

Tinker publishes per-token prices, so the first filter is arithmetic. Training cost per million tokens: **Qwen3-8B $0.44**, Qwen3.5-4B $0.737. A smaller model isn't automatically a cheaper one. Qwen3-8B was both cheaper to train and strong enough for the job. Locked in.

## 2. Shrink the bill before you shrink the model

My first instinct was JSON output. A typical deed answer was **547 tokens**. So I designed a line-per-call format:

```
POB iron pin
L N 41 0 0 E 121.9 ft | iron pin
C N 3 45 22 E 366.15 ft R 944.33 ft L | stone
```

Code converts it back to JSON. **145 tokens. 3.8× smaller.** Tinker bills per token, so this one choice cuts training, evaluation and local inference cost at once, and costs nothing to run. It's the best-value line of code in the project.

## 3. The actual training setup

```python
tc = await svc.create_lora_training_client_async(base_model="Qwen/Qwen3-8B", rank=32)

# loss only on the answer tokens, never on the deed prose
Datum(model_input=full[:-1],
      loss_fn_inputs=dict(weights=[0.0]*(len(prompt)-1) + [1.0]*len(completion),
                          target_tokens=full[1:]))

fb = await tc.forward_backward_async(batch, loss_fn="cross_entropy")
op = await tc.optim_step_async(AdamParams(learning_rate=lr_at(s), beta1=0.9, beta2=0.95, eps=1e-8))
```

- **LoRA rank 32**, batch size 16, peak LR 2e-4 with a 5-step warmup and linear decay to 10%
- **Loss masked to the completion**: the model learns to *write calls*, not to memorize deeds
- **Pipelined steps**: step *k+1* is submitted before step *k* returns, so the service never idles between round trips
- **A checkpoint every epoch** via `save_weights_for_sampler`, so epochs can be compared without retraining
- **A budget guard** that prices each job from token counts *before* submitting and refuses to launch one that would burn half the cap

## 4. Find the knee of the curve

I didn't train on everything and pray. Four runs, one epoch each, same 500 held-out deeds:

| training deeds | est. cost | read exactly right | silent errors |
|---|---|---|---|
| 250 | $0.04 | 38.6% | 19 |
| 500 | $0.08 | 92.6% | 0 |
| **1,000** | **$0.17** | **99.4%** | 0 |
| 2,000 | $0.34 | 99.6% | 0 |

![Accuracy per dollar](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/learning_curve.png)

**Seventeen cents buys 99.4%.** The curve also shows something accuracy alone hides: at 250 deeds the model isn't just weak, it's *dangerous* (19 wrong answers nobody flagged). The jump from 250 to 500 is where it becomes safe to trust.

## 5. Spend extra only where the eval says so

The first full model read my held-out *spelled-out* style at 85.6% exactly right, and flagged the other 14.4%. On held-out *varas*, it read every number correctly but wrote the unit as `var`, my decoder rejected it, and everything was flagged. Wrong answers? Zero. **The safety net held.**

The fix wasn't to patch the decoder for every spelling the model improvised. That's overfitting to the test. The fix was data: **150 spelled-out and 150 varas examples**, retrain, test on **fresh** deeds. That's the final model: 2,300 training deeds, 3 epochs, **$1.15**.

| fresh test set | n | read exactly right | silent errors |
|---|---|---|---|
| in distribution | 3,000 | **99.6%** | 2 (both label-format ties, 0 by physical length) |
| spelled-out numbers | 250 | 99.6% | 0 |
| varas | 250 | 100% | 0 |

## 6. Make evaluation free the second time

Evaluation was the bigger bill ($1.35 against $2.46 for all training), so I made it repeatable for nothing. Every sampled output is cached by checkpoint and input. The safety checks score from the cache, so improving the validator and re-scoring 3,000 deeds cost **$0**. At inference, one deed costs about **$0.0002** through Tinker.

## 7. Test the alarm you're relying on

I expected the model's own token probabilities to be a free early-warning system. I swept the confidence threshold from off to extreme. **Nothing moved.** The model is just as confident when it's wrong. So the real safety net is deterministic code, and the claim stayed out of the plan: of the 12 wrong outputs in the 3,000-deed run, **10 were caught by parse and closure alone.**

To keep the final number clean, I froze the validator and generated a fresh 3,000-deed set *before* the last evaluation, then ran it once.

## 8. Rent the training. Keep the weights.

The cheapest inference is the one you don't pay for. I downloaded the **369 MB LoRA adapter** from Tinker and ran it with **MLX on the Apple GPU**: a 4-bit Qwen3-8B base with the adapter applied at run time (253 modules, output head included).

> **150 of 150 deeds read exactly right, 0 flagged, median 7.5 seconds per deed.** M3 Pro, 18 GB, no network, no API key, no per-deed fee.

![Where all 3,000 deeds ended up](https://raw.githubusercontent.com/advikdivekar/deed/main/docs/charts/where_deeds_end_up.png)

### The whole bill

| item | est. cost |
|---|---|
| baseline, no training | $0.11 |
| learning-curve runs (250 / 500 / 1,000) | $0.29 |
| first full run (2,000 deeds) | $1.01 |
| **final model (2,300 deeds, 3 epochs)** | **$1.15** |
| all evaluation | $1.35 |
| **everything on Tinker** | **about $3.80** |

*Estimated from token counts at Tinker's list prices.*

The punchline, same base model, same prompt, same checks, only the fine-tune changed:

| | before fine-tune | after |
|---|---|---|
| read exactly right | 10% | **99.6%** |
| sent to a human | 82% | 0.4% |
| wrong **and** unflagged | 5 of 60 | **2 of 3,000** |

## Why Does Open Innovation Matter?

A closed API would have given me a prompt box. Open weights gave me a **steering wheel.**

- **I could change the model, not just the prompt.** Three examples in a prompt got 10%. A one-dollar LoRA got 99.6%. You can't fine-tune a model you only rent.
- **Deeds are private by nature.** They name people, parcels and mortgages. The weights run on the laptop that holds the file. Turn Wi-Fi off. It still works. There's no "we don't train on your data" policy to trust, because there's no one to send it to.
- **No meter running.** After the one-time fine-tune, the thousandth deed costs electricity.
- **Nobody can deprecate it.** The base model, the adapter and the code sit on disk. A better open model next year is a training run, not a migration.
- **I could look inside.** Every finding in this post, the confidence result, the varas failure, the label tie, exists because I could inspect every output.

## My Agent Session

I built DeedReader with Claude Code as a pair, working to a written plan with a cost estimate up front and a budget guard on every training job.

- It **read Tinker's docs before writing a line against the API**, and wrote closure-math tests before any model touched the project.
- The baseline exposed a blind spot: many of the base model's *landmark names* were wrong, and closure can't see that. So it built the per-sentence grounding check. Those errors would have been silent.
- It debugged its own validator by running it on the generator's **ground truth**, where a perfect model must produce zero flags. "Chains and links" parsing, "due north" with no number, and splitting on "running thence" each caused false alarms until fixed.
- When varas failed, it **refused to keep patching the decoder** and ran the real fix as a proper experiment on fresh data.
- It caught itself: a confidence floor it had described as "tuned" was never tuned (corrected in code and report), and a UI banner that read "Parcel closes" on a failed check got fixed. When I sent screenshots of overlapping map labels, it rebuilt the plot, then rebuilt the whole view on a real map.

## The Lazy Payoff

The usual route: read the deed, convert every bearing, protractor and scale, draw each leg, check the closure, compute the area. **Fifteen to thirty minutes.**

The DeedReader route: **paste, glance, approve.**

If the deed is clean, that's the whole job. If it isn't, you don't get a confident wrong drawing. You get the line to look at and, usually, the one-digit fix that closes the parcel. It's the laziest possible workflow with the single property a lazy workflow needs: **it fails loudly.**

Slow and Steady, finally automated.

## Prize Categories

**Best Use of Tinker.** The LoRA fine-tune (pipelined forward and backward passes, loss-masked completions, per-epoch checkpoints), the baseline, the data-size learning curve, more than 4,000 evaluated deeds, and the adapter download behind the offline story all ran on Tinker. **$1.15 for the final model, about $3.80 for the whole project.** Same base model, same prompt, same checks, and the fine-tune alone took exact reads from **10% to 99.6%**.

*Built solo, with Claude Code.*
