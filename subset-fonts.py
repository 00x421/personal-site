"""Subset full Noto Serif SC OTFs to site chars -> one woff2 per weight.

Re-run when site copy changes (new articles add new hanzi):
  1. Collect chars from all rendered pages into %TEMP%/site-chars.txt
     (unique chars, one per line or raw string)
  2. Download full OTFs to %TEMP%/noto-src/ from
     https://github.com/notofonts/noto-cjk/tree/main/Serif/SubsetOTF/SC
     (NotoSerifSC-Regular/Medium/Bold.otf)
  3. python subset-fonts.py
  4. Rebuild; glyphs missing from the subset fall back to system serif.
"""
import os
from fontTools.subset import Subsetter, Options, load_font

SRC = os.path.expandvars(r"%TEMP%\noto-src")
OUT_DIR = r"public\fonts"
FILES = {"400": "NotoSerifSC-Regular.otf", "500": "NotoSerifSC-Medium.otf", "700": "NotoSerifSC-Bold.otf"}

EXTRA = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,;:!?'\u2019\"()-\u2014\u2013_/\\@#$%&*+=<>[]{}|~^`"
    "\u3000\u3001\u3002\uff0c\uff1a\uff1b\uff1f\uff01\uff08\uff09\u201c\u201d\u2018\u2019\u300a\u300b\u2014\u2026\u00b7"
)

with open(os.path.expandvars(r"%TEMP%\site-chars.txt"), encoding="utf-8") as f:
    text = f.read() + EXTRA

os.makedirs(OUT_DIR, exist_ok=True)

for weight, name in FILES.items():
    src = os.path.join(SRC, name)
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG", "vhea", "vmtx"]
    font = load_font(src, opts)
    subsetter = Subsetter(options=opts)
    subsetter.populate(text=text)
    subsetter.subset(font)
    out = os.path.join(OUT_DIR, f"noto-serif-sc-{weight}.woff2")
    font.save(out)
    n = len(font.getGlyphOrder())
    print(f"{weight}: {n} glyphs -> {out} ({os.path.getsize(out)/1024:.0f} KB)")
print("DONE")
