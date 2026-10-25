"""Extra splits, generated after seeing v1 results: (a) a few examples of the 'held-out' style/unit to measure how cheaply a new style is onboarded,
(b) fresh test sets for them, (c) a 3,000-deed in-distribution set big enough to bound a 0.1% silent-error rate."""
import json, random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from data.gen import TRAIN_STYLES, make_example

OUT = Path("data/out")
seen = {json.loads(l)["text"] for f in OUT.glob("*.jsonl") for l in open(f)}

def build(name, n, styles, seed):
    rng = random.Random(seed); i = 0
    with open(OUT / f"{name}.jsonl", "w") as f:
        while i < n:
            ex = make_example(rng, styles[i % len(styles)])
            if ex["text"] in seen: continue
            seen.add(ex["text"]); ex["id"] = f"{name}-{i:05d}"; ex["split"] = name; f.write(json.dumps(ex) + "\n"); i += 1
    print(name, n)

build("train_v2_extra", 300, ["spelled", "varas"], 4242)
build("test_spelled_fresh", 250, ["spelled"], 5252)
build("test_varas_fresh", 250, ["varas"], 5353)
build("test_id_big", 3000, TRAIN_STYLES, 99)
