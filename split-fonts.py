"""Split subsetted Noto Serif SC woff2 into unicode-range slices.

Input: fonts-src/noto-serif-sc-{400,500,700}.woff2 (site-char subsets,
NOT in git - regenerate with subset-fonts.py or restore from git history
before commit a67c50c). Critical slice = first-screen chars + ASCII/punct;
remaining chars split ~110/char-slice. Output CSS block printed to stdout;
font files land in public/fonts/slices/.

Re-run when site copy changes:
  1. Update FIRST_SCREEN chars below (or re-capture from rendered page)
  2. python split-fonts.py
  3. Paste CSS block into app/globals.css replacing old @font-face rules
"""
import base64
import os
from fontTools.subset import Subsetter, Options, load_font

CRITICAL_B64 = "WFdTwrfpobnnm67lhbPkuo7mioDmnK/mlofnq6DogZTns7vmiJHmiorlpI3mnYLnmoTmg7Pms5XvvIzlgZrlvpfmuIXmmbDjgILova/ku7blt6XnqIvluIjkuqflk4HmnoTlu7rogIUyMDbkvaDlpb3mmK9MaW5sZ1HorrDlvZXjgIHku6PnoIHkuI7mgJ3ogIPkuKrkurrnqbrpl7TvvJvlnKjorr7orqFBSeS6pOeVjOWkhOS9nGNvc3RtPSLkv6HmiYDooYw755yL5LuA5LmI5LiA6LW35a6D5Y+Y5oiQ546w5a6e5pyJ5YC86Kej5Yaz6Zeu6aKY77yf"

CRITICAL = set(base64.b64decode(CRITICAL_B64).decode("utf-8"))
CRITICAL |= set("当前待机思考中和空气小狗打招呼很高兴见聊聊天")
CRITICAL |= set(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,;:!?'\u2019\"()-\u2014\u2013_/\\@#$%&*+=<>[]{}|~^`"
    "\u3000\u3001\u3002\uff0c\uff1a\uff1b\uff1f\uff01\uff08\uff09\u201c\u201d\u2018\u2019\u300a\u300b\u2014\u2026\u00b7"
)

SLICE_SIZE = 110
WEIGHTS = ["400", "500", "700"]
OUT_DIR = os.path.join("public", "fonts", "slices")


def ranges(codes):
    out, start, prev = [], None, None
    for c in sorted(codes):
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            out.append((start, prev))
            start = prev = c
    if start is not None:
        out.append((start, prev))
    return ",".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in out)


def subset_to(src, chars, dest):
    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt"]
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.notdef_outline = True
    opts.drop_tables += ["DSIG", "vhea", "vmtx"]
    font = load_font(src, opts)
    sub = Subsetter(options=opts)
    sub.populate(unicodes=chars)
    sub.subset(font)
    font.save(dest)
    return os.path.getsize(dest)


os.makedirs(OUT_DIR, exist_ok=True)

# read full subset cmap from existing 500 weight
probe = load_font("fonts-src/noto-serif-sc-500.woff2", Options())
all_chars = set(probe.getBestCmap().keys())
probe.close()

rest = sorted(all_chars - CRITICAL)
slices = [rest[i : i + SLICE_SIZE] for i in range(0, len(rest), SLICE_SIZE)]
slices = [sorted(ord(c) for c in CRITICAL)] + slices  # slice 0 = critical

css = []
total = {}
for weight in WEIGHTS:
    src = f"fonts-src/noto-serif-sc-{weight}.woff2"
    for idx, chars in enumerate(slices):
        name = f"noto-serif-sc-{weight}-s{idx}.woff2"
        dest = os.path.join(OUT_DIR, name)
        size = subset_to(src, chars, dest)
        total[name] = size
        css.append(
            "@font-face {\n"
            "  font-family: 'Noto Serif SC';\n"
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/slices/{name}') format('woff2');\n"
            f"  unicode-range: {ranges(chars)};\n"
            "}"
        )

for weight in WEIGHTS:
    w_total = sum(v for k, v in total.items() if f"-{weight}-" in k)
    print(f"weight {weight}: {len(slices)} slices, {w_total/1024:.0f} KB total")
print(f"critical slice: {total[f'noto-serif-sc-500-s0.woff2']/1024:.1f} KB (w500)")
print("\n".join(css))
print("DONE")
