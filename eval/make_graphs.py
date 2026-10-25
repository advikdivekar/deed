"""Extra charts for the post and the video: loss curve, cost breakdown, token compaction, before/after. python -m eval.make_graphs"""
import re
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/charts"
INK, TEAL, TERRA, GREY = "#003135", "#0098A6", "#B5472B", "#9DB5B7"


def style(ax, title):
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color(GREY)
    ax.tick_params(colors=INK, labelsize=10)
    ax.set_title(title, loc="left", fontsize=13, fontweight="bold", color=INK, pad=12)


def loss_curve():
    rows = [(int(m.group(1)), float(m.group(2))) for l in open(ROOT / "results/sft_v2.log") if (m := re.match(r"step (\d+)/429 .*'loss:sum': ([\d.]+)", l))]
    x, y = zip(*rows)
    fig, ax = plt.subplots(figsize=(9, 4), dpi=200)
    ax.semilogy(x, y, color=TEAL, lw=2.2, marker="o", ms=3.5)
    for ep in (143, 286): ax.axvline(ep, color=GREY, ls="--", lw=1)
    for i, ep in enumerate(("epoch 1", "epoch 2", "epoch 3")): ax.text(71 + 143 * i, 3000, ep, ha="center", fontsize=9, color=INK)
    ax.annotate("1,806 at step 1", (1, y[0]), (40, 600), arrowprops=dict(arrowstyle="-", color=GREY), fontsize=9, color=INK)
    ax.annotate("under 1 by step 41", (41, 0.1057), (90, 40), arrowprops=dict(arrowstyle="-", color=GREY), fontsize=9, color=INK)
    ax.set_xlabel("optimizer step (429 total, batch 16, 16 minutes on Tinker)", color=INK); ax.set_ylabel("cross-entropy loss, summed over the batch", color=INK)
    ax.set_ylim(5e-5, 6000); style(ax, "Training loss: the format is learned in about 40 steps")
    fig.savefig(OUT / "training_loss.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


def cost_breakdown():
    items = [("learning-curve runs\n(250 / 500 / 1,000 deeds)", 0.29, TEAL), ("first full run\n(2,000 deeds)", 1.01, TEAL), ("final model\n(2,300 deeds, 3 epochs)", 1.15, TEAL), ("all evaluation\n(about 9,400 sampled deeds)", 1.35, GREY)]
    fig, ax = plt.subplots(figsize=(9, 3.8), dpi=200)
    ax.barh(range(4), [v for _, v, _ in items], color=[c for *_, c in items], height=.62)
    for i, (_, v, _) in enumerate(items): ax.text(v + .03, i, f"${v:.2f}", va="center", fontsize=11, fontweight="bold", color=INK)
    ax.set_yticks(range(4)); ax.set_yticklabels([n for n, *_ in items], fontsize=10, color=INK); ax.invert_yaxis(); ax.set_xlim(0, 1.7); ax.set_xticks([])
    ax.spines["left"].set_visible(False); ax.spines["bottom"].set_visible(False)
    style(ax, "Where the $3.80 went (teal: training, grey: evaluation)"); ax.spines["left"].set_visible(False); ax.spines["bottom"].set_visible(False)
    fig.savefig(OUT / "cost_breakdown.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


def tokens():
    fig, ax = plt.subplots(figsize=(9, 3.2), dpi=200)
    ax.barh([0, 1], [547, 145], color=[GREY, TEAL], height=.55)
    ax.text(552, 0, "547 tokens  ·  $0.33 per 1,000 deeds sampled", va="center", fontsize=11, color=INK); ax.text(150, 1, "145 tokens  ·  $0.09", va="center", fontsize=11, fontweight="bold", color=INK)
    ax.set_yticks([0, 1]); ax.set_yticklabels(["JSON output", "line-per-call format"], fontsize=11, color=INK); ax.invert_yaxis(); ax.set_xlim(0, 1100); ax.set_xticks([])
    style(ax, "3.8x fewer tokens: one choice cuts every bill"); ax.spines["left"].set_visible(False); ax.spines["bottom"].set_visible(False)
    fig.savefig(OUT / "token_compaction.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


def before_after():
    groups = ["in distribution", "numbers spelled out", "Texas varas"]
    base = [10.0, 16.7, 10.0]; v1 = [99.8, 85.6, 20.8]; v2 = [99.6, 99.6, 100.0]
    fig, ax = plt.subplots(figsize=(9.5, 4.4), dpi=200)
    w = .26
    for k, (vals, col, lab) in enumerate([(base, GREY, "untrained, 3 examples in the prompt"), (v1, "#7FC8CF", "fine-tuned, style or unit never seen"), (v2, TEAL, "fine-tuned, after 150 examples of it")]):
        xs = [i + (k - 1) * w for i in range(3)]
        ax.bar(xs, vals, w * .92, color=col, label=lab)
        for x, v in zip(xs, vals): ax.text(x, v + 1.5, f"{v:g}%", ha="center", fontsize=9.5, fontweight="bold" if k == 2 else None, color=INK)
    ax.set_xticks(range(3)); ax.set_xticklabels(groups, fontsize=11, color=INK); ax.set_ylim(0, 118); ax.set_yticks([0, 25, 50, 75, 100]); ax.set_yticklabels([f"{t}%" for t in (0, 25, 50, 75, 100)])
    ax.legend(frameon=False, fontsize=9, loc="upper center", bbox_to_anchor=(.5, -.12), ncol=3)
    style(ax, "Deeds read exactly right: 10% to 99.6%")
    fig.savefig(OUT / "before_after.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


if __name__ == "__main__":
    loss_curve(); cost_breakdown(); tokens(); before_after(); print("ok")
