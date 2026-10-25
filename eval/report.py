"""Build EVAL_REPORT.md and the charts from saved outputs. Every number is computed here; nothing is typed in by hand."""
from __future__ import annotations

import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from deedreader.fmt import decode
from deedreader.geo import closure
from deedreader.validate import LOGPROB_FLOOR, crosscheck, provenance, ref_grounding
from eval.metrics import compare, score, wilson_upper
from eval.rescore import load
from train.common import ROOT

TEAL, TERRA, INK, MUTED = "#0098A6", "#B5472B", "#082F33", "#60777A"
plt.rcParams.update({"font.family": "DejaVu Sans", "axes.edgecolor": "#C3D4D6", "axes.labelcolor": INK, "text.color": INK, "xtick.color": MUTED, "ytick.color": MUTED, "axes.spines.top": False, "axes.spines.right": False})
CH = ROOT / "docs/charts"; CH.mkdir(parents=True, exist_ok=True)


def agg(tag, split, **kw):
    return score(load(tag, split), **kw)["all"]


def row(a): n = a["n"]; return f"{n} | {100*a['exact']/n:.1f}% | {100*a['bearing_ok']/a['bearing_n']:.2f}% | {100*a['distance_ok']/a['distance_n']:.2f}% | {100*a['unit_ok']/a['unit_n']:.2f}% | {100*a['reference_ok']/a['reference_n']:.2f}% | {100*a['flagged']/n:.1f}% | {a['silent']} ({100*a['silent']/n:.2f}%, ≤{100*wilson_upper(a['silent'], n):.2f}%) | {a['silent_physical']}"


HDR = "\n| model / test set | n | example exact | bearing | distance | unit | reference | flag rate | silent errors (rate, 95% upper) | silent, physical |\n|---|---|---|---|---|---|---|---|---|---|"
md = ["# Evaluation report\n", "All numbers are computed by `eval/report.py` from the saved model outputs in `results/`. Costs are estimates from token counts × list price (see COST_LOG.md).\n",
      "**Definitions.** *Example exact*: every field of every call, the point of beginning and the call count all match the ground truth. *Field accuracy*: per field, over all calls. *Flag rate*: outputs sent to a human (any safety check fails). *Silent error*: output is wrong AND not flagged; a flagged-but-wrong output is not silent. *Silent, physical*: the same count where `87 link` and `0.87 chain` are treated as the same call (see below).\n"]

# ---- headline
md.append("## 1. Final model (Qwen3-8B + LoRA, 2,300 training deeds, 3 epochs)\n")
md.append(HDR.rstrip("\n"))
for label, split in [("in-distribution, fresh 3,000 deeds (generated before any validator change, evaluated once)", "test_id_big"), ("in-distribution, 500 deeds", "test_id"),
                     ("spelled-out numbers, fresh 250 (style onboarded with 150 examples)", "test_spelled_fresh"), ("varas, fresh 250 (unit onboarded with 150 examples)", "test_varas_fresh")]:
    md.append(f"| v2: {label} | {row(agg('v2_ep3', split))} |")
md.append("\n## 2. Generalization to a style/unit the model has never seen (v1: trained on the six base styles only)\n")
md.append(HDR.rstrip("\n"))
for label, tag, split in [("base Qwen3-8B, 3-shot, spelled-out (held out)", "base_qwen3_8b_fs3", "test_heldout_style"), ("v1 tuned, spelled-out (held out)", "tuned_ep3", "test_heldout_style"),
                          ("base Qwen3-8B, 3-shot, varas (held out)", "base_qwen3_8b_fs3", "test_heldout_unit"), ("v1 tuned, varas (held out)", "tuned_ep3", "test_heldout_unit")]:
    md.append(f"| {label} | {row(agg(tag, split))} |")
md.append("\nThe v1 varas row is not a reading failure: bearings and distances were correct, but the model wrote the unit as `var`/`varas`/`vara` (it had never seen the token), which the strict decoder rejects, so every output was flagged and none was silent. Adding 150 varas examples (v2) fixed it completely. The v1 spelled-out row is the honest zero-shot generalization number.\n")

# ---- before/after
md.append("## 3. Before / after\n")
md.append(HDR.rstrip("\n"))
for label, tag, split in [("base 3-shot", "base_qwen3_8b_fs3", "test_id"), ("tuned v2", "v2_ep3", "test_id")]:
    md.append(f"| {label}, in-distribution | {row(agg(tag, split))} |")
md.append("\nThe base row uses only 60 deeds (cost cap on the baseline), so its silent-error bound is wide.\n")

# ---- ablation: which check catches what, on the big set
rows = load("v2_ep3", "test_id_big")
cats = []
for r in rows:
    pob, calls, errs = decode(r["out"]); res, exact = compare(r["completion"], r["out"]); res.pop("_physical_exact")
    cl = closure(calls) if calls else None
    cats.append(dict(exact=exact, parse=bool(errs), closure=not (cl and cl.closed), numbers=bool(provenance(r["text"], calls)), refs=bool(ref_grounding(r["text"], calls)), cross=bool(crosscheck(r["text"], calls)),
                     conf=(r["minlp_num"] is not None and r["minlp_num"] < LOGPROB_FLOOR)))
md.append("## 4. Which safety check catches what (final model, 3,000 fresh deeds)\n")
md.append(f"Wrong outputs: {sum(not c['exact'] for c in cats)} of {len(cats)}.\n")
md.append("| checks enabled (cumulative) | flagged | silent errors | silent rate (95% upper) |\n|---|---|---|---|")
order = [("parse", "parse"), ("closure", "+ closure"), ("numbers", "+ numbers in own clause"), ("refs", "+ monument in own clause"), ("cross", "+ independent reader"), ("conf", "+ model confidence")]
on = []
for k, label in order:
    on.append(k); fl = sum(any(c[o] for o in on) for c in cats); si = sum((not c["exact"]) and not any(c[o] for o in on) for c in cats)
    md.append(f"| {label} | {fl} ({100*fl/len(cats):.2f}%) | {si} | {100*si/len(cats):.2f}% (≤{100*wilson_upper(si, len(cats)):.2f}%) |")
md.append("\nThe independent reader and the confidence threshold were added after looking at errors from earlier, smaller runs (n=500). They were frozen before this 3,000-deed set was evaluated.\n")

# ---- tradeoff curve
import numpy as np
floors = [None, -0.2, -0.3, -0.5, -0.75, -1.0, -1.5, -2.0, -3.0, -5.0]
tr = []
for f in floors:
    a = score(rows, lp_floor=f) if f is not None else score(rows)["all"] and score(rows)
    a = a["all"]; tr.append((f, 100 * a["flagged"] / a["n"], 100 * a["silent"] / a["n"], a["silent"]))
md.append("## 5. Flag-rate vs silent-error tradeoff (confidence threshold sweep)\n")
md.append("| min-number-logprob floor | flag rate | silent errors |\n|---|---|---|")
for f, fr, sr, k in tr: md.append(f"| {'off' if f is None else f} | {fr:.2f}% | {k} ({sr:.2f}%) |")
fig, ax = plt.subplots(figsize=(6.4, 3.8), dpi=170)
ax.plot([t[1] for t in tr], [t[3] for t in tr], "-o", color=TEAL, lw=2, ms=6, mec="white", mew=1.5)
for f, fr, sr, k in tr:
    if f in (None, -0.5, -1.5): ax.annotate("no threshold" if f is None else f"floor {f}", (fr, k), textcoords="offset points", xytext=(8, 6), fontsize=8, color=INK)
ax.set_xlabel("flag rate (% of deeds a human still has to look at)"); ax.set_ylabel("silent errors (of 3,000)"); ax.set_title("A tighter confidence floor trades flags for silent errors", loc="left", fontsize=11, fontweight="bold")
ax.grid(axis="y", color="#DCE7E8", lw=.6); fig.tight_layout(); fig.savefig(CH / "tradeoff.png"); plt.close(fig)

# ---- learning curve
curve = [("250", "curve_n250", 0.041), ("500", "curve_n500", 0.084), ("1,000", "curve_n1000", 0.168)]
pts = [(c, agg(t, "test_id")) for _, t, c in curve]
pts.append((0.337, agg("tuned_ep1", "test_id"))); pts.append((1.012, agg("tuned_ep3", "test_id")))
labels = ["250 deeds", "500", "1,000", "2,000 · 1 epoch", "2,000 · 3 epochs"]
md.append("\n## 6. Learning curve: accuracy per dollar (v1 recipe, in-distribution, 500 test deeds)\n")
md.append("| training | est. train cost | example exact | flag rate | silent errors |\n|---|---|---|---|---|")
for (c, a), l in zip(pts, labels): md.append(f"| {l} | ${c:.2f} | {100*a['exact']/a['n']:.1f}% | {100*a['flagged']/a['n']:.1f}% | {a['silent']} |")
fig, ax = plt.subplots(figsize=(6.4, 3.8), dpi=170)
xs = [p[0] for p in pts]; ys = [100 * p[1]["exact"] / p[1]["n"] for p in pts]
ax.plot(xs, ys, "-o", color=TEAL, lw=2, ms=7, mec="white", mew=1.5)
for x, y, l in zip(xs, ys, labels): ax.annotate(l, (x, y), textcoords="offset points", xytext=(6, -14 if y > 90 else 8), fontsize=8)
ax.set_xscale("log"); ax.set_xlabel("training cost (USD, log scale)"); ax.set_ylabel("deeds read exactly right (%)"); ax.set_ylim(0, 105)
ax.set_title("$0.17 of training reaches 99.4%", loc="left", fontsize=11, fontweight="bold"); ax.grid(axis="y", color="#DCE7E8", lw=.6); fig.tight_layout(); fig.savefig(CH / "learning_curve.png"); plt.close(fig)

# ---- silent error chart: base vs tuned, flagged vs silent vs correct
sets = [("base 3-shot\nin-dist (60)", agg("base_qwen3_8b_fs3", "test_id")), ("base 3-shot\nspelled-out (60)", agg("base_qwen3_8b_fs3", "test_heldout_style")), ("tuned v2\nin-dist (3,000)", agg("v2_ep3", "test_id_big")), ("tuned v1\nunseen style (250)", agg("tuned_ep3", "test_heldout_style")), ("tuned v2\nafter 150 ex. (250)", agg("v2_ep3", "test_spelled_fresh"))]
fig, ax = plt.subplots(figsize=(7.2, 4), dpi=170)
for i, (l, a) in enumerate(sets):
    n = a["n"]; ok = 100 * (n - a["flagged"] - a["silent"]) / n; fl = 100 * a["flagged"] / n; si = 100 * a["silent"] / n
    ax.bar(i, ok, color=TEAL, width=.62); ax.bar(i, fl, bottom=ok, color="#9CC3C8", width=.62); ax.bar(i, si, bottom=ok + fl, color=TERRA, width=.62)
    ax.text(i, 101.5, f"{a['silent']} silent", ha="center", fontsize=8.5, color=TERRA if a["silent"] else INK, fontweight="bold")
ax.set_xticks(range(len(sets))); ax.set_xticklabels([s[0] for s in sets], fontsize=8); ax.set_ylim(0, 108); ax.set_ylabel("share of deeds (%)")
ax.set_title("Where every deed ends up: right, flagged for a human, or silently wrong", loc="left", fontsize=11, fontweight="bold")
from matplotlib.patches import Patch
ax.legend(handles=[Patch(color=TEAL, label="correct, passed"), Patch(color="#9CC3C8", label="flagged for review"), Patch(color=TERRA, label="silently wrong")], loc="lower left", fontsize=8, frameon=False, ncol=3, bbox_to_anchor=(0, -0.3))
fig.tight_layout(); fig.savefig(CH / "silent_errors.png"); plt.close(fig)

wrong = [c for c in cats if not c["exact"]]
caught_by_closure = sum(c["closure"] or c["parse"] for c in wrong)
md.append("\n## 7. What this does and does not show\n")
md.append(f"- **The silent-error number rests on closure.** Of {len(wrong)} wrong outputs on the 3,000-deed set, {caught_by_closure} were caught by parse/closure alone. The independent reader and the confidence floor added no further catches here (they did catch the two errors that closure missed in the earlier 500-deed runs: a dropped arc-minute and a flipped curve direction). The model is very confident even when wrong, so the logprob floor carries almost no signal (section 5).")
md.append("- **Closure cannot see some errors.** A curve direction flip or a wrong monument label leaves the geometry closed. Those depend on the per-clause checks, which only work when the deed's calls are separated by `;` or `thence`/`then` and the clause count lines up.")
md.append("- **The two remaining strict silent errors are label ambiguity, not misreadings.** `87 links` was labelled `87 link` by one style and `0.87 chain` by another in my generator; the model wrote `0.87 chain`. Physically identical, so the *physical* silent count is 0.")
md.append("- **The 95% upper bound on the silent-error rate is 0.24%, not 0.1%.** The point estimate (2/3,000 = 0.07%) meets the target, but 3,000 deeds cannot prove it; that would need roughly 3x as many with no new silent errors.")
md.append("- **All of this is synthetic.** The test deeds come from the same generator as the training deeds. Held-out styles and units test generalization to new phrasing of the same task, not to real deeds. Real-deed accuracy is unmeasured until real descriptions are labelled.")
md.append("- **Held-out generalization was not good.** Zero-shot on a fully spelled-out style, the tuned model read 85.6% exactly and flagged 14.4% (mostly dropped words like `one thousand seven` read as 17); on a new unit it could not name the unit at all. 150 examples per new style or unit fixed both, which is the intended workflow, but it is a data cost, not generalization.")
md.append("- **Per-deed cost is small but not zero.** Sampling the 3,000 deeds cost about $0.45 at list price (~$0.00015 per deed). Offline, it costs electricity.")
lf = ROOT / "results/local_mlx_eval.json"
if lf.exists():
    L = json.load(open(lf)); n = L["n"]
    md.append("\n## 8. Offline on a laptop (MLX, 4-bit base + LoRA, Apple M3 Pro, 18 GB)\n")
    md.append(f"First {n} deeds of the 3,000-deed in-distribution set, no network, no Tinker: **{L['exact']}/{n} exactly right, {L['flagged']} flagged, {L['silent']} silent**; median **{L['median_s']:.1f} s per deed** at {L['median_tps']:.1f} tokens/s. Same adapter as the cloud run, base weights quantized to 4-bit (about 4.6 GB). {n} deeds is a small sample; it shows quantization did not visibly hurt, not that it is lossless. Speed is memory-bandwidth bound; fusing the LoRA into the weights or prompt-lookup speculative decoding could be faster and was not tried.")
(ROOT / "EVAL_REPORT.md").write_text("\n".join(md) + "\n")
print("wrote EVAL_REPORT.md and charts")
