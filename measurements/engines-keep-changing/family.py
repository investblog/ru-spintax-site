# The test card through the Python engine: pip install spintax-core==0.5.0 (the version this
# article's table reports; drop the pin to score whatever is current), then python family.py
# Prints one line per case: its id and the share of renders that come out right (as measure.mjs scores it).
import json
import re
from importlib.metadata import version
from pathlib import Path

from spintax_core import render

SEEDS = 100


def distinct(out: str) -> bool:
    """A permutation shuffles distinct elements, which no regex alternation can say."""
    items = re.split(r",\s*|\s+and\s+", re.sub(r"^[^:]*:\s*", "", out).rstrip("."))
    return len(set(items)) == len(items)


card = json.loads((Path(__file__).parent / "card.json").read_text(encoding="utf-8"))["cases"]
print("spintax-core", version("spintax-core"))
for c in card:
    ctx = c.get("context", {})
    if "expect" in c:
        out = render(c["src"], context=ctx, seed=1)
        score = 1.0 if out == c["expect"] else 0.0
    else:
        shape = re.compile(c["shape"])
        outs = [render(c["src"], context=ctx, seed=s) for s in range(1, SEEDS + 1)]
        out = outs[0]
        score = sum(1 for o in outs if shape.fullmatch(o) and distinct(o)) / SEEDS
    print(f"{c['id']:<26}{score:.2f}  {json.dumps(out, ensure_ascii=False)}")
