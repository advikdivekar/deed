"""Architecture and fine-tuning diagrams for the post. Pure matplotlib, no data needed: python -m eval.make_diagrams"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = Path(__file__).resolve().parent.parent / "docs/charts"
INK, TEAL, TERRA, PAPER, LINE = "#003135", "#0098A6", "#B5472B", "#F4F7F7", "#9DB5B7"


def box(ax, x, y, w, h, title, sub="", fill="white", edge=TEAL, tc=INK, lw=1.6):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.12", fc=fill, ec=edge, lw=lw))
    ax.text(x + w / 2, y + h * (0.64 if sub else 0.5), title, ha="center", va="center", fontsize=11.5, fontweight="bold", color=tc)
    if sub: ax.text(x + w / 2, y + h * 0.28, sub, ha="center", va="center", fontsize=8.8, color=tc, alpha=.85)


def arrow(ax, a, b, color=INK, rad=0.0, ls="-"):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=14, lw=1.6, color=color, connectionstyle=f"arc3,rad={rad}", linestyle=ls))


def canvas(w, h, title):
    fig, ax = plt.subplots(figsize=(w, h), dpi=200); fig.patch.set_facecolor("white")
    ax.set_xlim(0, w); ax.set_ylim(0, h); ax.axis("off")
    ax.text(0.15, h - 0.3, title, fontsize=15, fontweight="bold", color=INK, va="center")
    return fig, ax


def architecture():
    fig, ax = canvas(12, 4.6, "The model reads. Code decides.")
    box(ax, 0.3, 2.1, 2.1, 1.3, "Deed text", "any style, any unit", PAPER, LINE)
    box(ax, 3.1, 2.1, 2.5, 1.3, "Qwen3-8B + LoRA", "the only AI part", TEAL, TEAL, "white")
    box(ax, 6.3, 2.1, 2.1, 1.3, "Calls", "one per line, compact", PAPER, LINE)
    box(ax, 9.1, 2.1, 2.6, 1.3, "Closure + area", "plain code, tested", "white", INK)
    for a, b in [((2.4, 2.75), (3.1, 2.75)), ((5.6, 2.75), (6.3, 2.75)), ((8.4, 2.75), (9.1, 2.75))]: arrow(ax, a, b)
    box(ax, 3.1, 0.35, 8.6, 1.0, "Six safety checks, all plain code", "parses · closes · numbers in own clause · monuments grounded · 2nd reader agrees", "#FBEFEA", TERRA)
    arrow(ax, (7.35, 2.1), (7.35, 1.35), TERRA)
    ax.text(0.3, 0.85, "Any failed check:\nNEEDS HUMAN REVIEW\n+ the fix that closes it", fontsize=8.6, color=TERRA, va="center", fontweight="bold")
    fig.savefig(OUT / "architecture.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


def finetune():
    fig, ax = canvas(13, 6.4, "Fine-tuning on Tinker: every dollar had a job")
    row1 = 4.3
    box(ax, 0.2, row1, 2.5, 1.35, "Generator", "closed polygon, known truth\n6 styles + distractors", PAPER, LINE)
    box(ax, 3.2, row1, 2.5, 1.35, "Compact format", "145 tokens, not 547 (3.8x)\ncuts every later bill", "white", TEAL)
    box(ax, 6.2, row1, 2.6, 1.35, "Tinker LoRA SFT", "Qwen3-8B · rank 32 · bs 16\nlr 2e-4 · loss on completion only", TEAL, TEAL, "white")
    box(ax, 9.3, row1, 3.5, 1.35, "Checkpoint per epoch", "save_weights_for_sampler\nep1 / ep2 / ep3 kept", "white", TEAL)
    for a, b in [((2.7, row1 + .67), (3.2, row1 + .67)), ((5.7, row1 + .67), (6.2, row1 + .67)), ((8.8, row1 + .67), (9.3, row1 + .67))]: arrow(ax, a, b)
    row2 = 2.2
    box(ax, 9.3, row2, 3.5, 1.35, "Evaluate on fresh deeds", "3,000 + held-out style & unit\ncached: never pay twice", "white", INK)
    box(ax, 6.2, row2, 2.6, 1.35, "Validator", "6 checks, frozen before\nthe final eval run", "#FBEFEA", TERRA)
    box(ax, 3.2, row2, 2.5, 1.35, "Decide", "learning curve picks\nthe cheapest data size", PAPER, LINE)
    arrow(ax, (11.05, row1), (11.05, row2 + 1.35)); arrow(ax, (9.3, row2 + .67), (8.8, row2 + .67)); arrow(ax, (6.2, row2 + .67), (5.7, row2 + .67))
    arrow(ax, (3.2, row2 + .67), (1.9, row1 - .02), rad=-0.25, ls="--")
    ax.text(0.3, 3.1, "add data only if\nthe eval says so", fontsize=9, color=INK, style="italic")
    box(ax, 9.3, 0.3, 3.5, 1.15, "Download the adapter", "369 MB · weights are yours", "white", TEAL)
    box(ax, 5.0, 0.3, 3.7, 1.15, "MLX, 4-bit base + LoRA", "Apple GPU · no network · $0", TEAL, TEAL, "white")
    box(ax, 0.9, 0.3, 3.2, 1.15, "150/150 exact", "median 7.5 s per deed", PAPER, LINE)
    arrow(ax, (11.05, row2), (11.05, 1.45)); arrow(ax, (9.3, .87), (8.7, .87)); arrow(ax, (5.0, .87), (4.1, .87))
    fig.savefig(OUT / "finetune_pipeline.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


def funnel():
    fig, ax = plt.subplots(figsize=(9, 3.6), dpi=200)
    labels = ["3,000 deeds", "exactly right", "wrong, caught by\nparse + closure", "wrong and\nsilent (strict)"]
    vals = [3000, 2988, 10, 2]
    cols = [LINE, TEAL, TEAL, TERRA]
    ax.barh(range(4), [max(v, 14) for v in vals], color=cols, height=.62)
    for i, v in enumerate(vals): ax.text(max(v, 14) + 40, i, f"{v:,}", va="center", fontsize=11, color=INK, fontweight="bold")
    ax.set_yticks(range(4)); ax.set_yticklabels(labels, fontsize=10, color=INK); ax.invert_yaxis(); ax.set_xlim(0, 3500); ax.set_xticks([])
    for s in ("top", "right", "bottom"): ax.spines[s].set_visible(False)
    ax.set_title("Where every deed ends up (fresh, frozen validator)", loc="left", fontsize=13, fontweight="bold", color=INK)
    ax.text(3480, 3.45, "both 'silent' ones are 87 link = 0.87 chain\n(same physical length): 0 by physical length", ha="right", fontsize=8.5, color=TERRA)
    fig.savefig(OUT / "where_deeds_end_up.png", bbox_inches="tight", facecolor="white"); plt.close(fig)


if __name__ == "__main__":
    architecture(); finetune(); funnel(); print("ok")
