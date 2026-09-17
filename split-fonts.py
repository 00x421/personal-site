"""Split subsetted Noto Serif SC woff2 into unicode-range slices.

Input: fonts-src/noto-serif-sc-{400,500,700}.woff2 (site-char subsets,
NOT in git - regenerate with subset-fonts.py).
Critical slice = first-screen chars + ASCII/punct; remaining chars split
~110/char-slice. Output CSS block printed to stdout; font files land in
public/fonts/slices/.

Re-run when site copy changes:
  1. Refresh CRITICAL_B64 below. Easiest reliable way: fetch the live
     homepage, strip tags, take the first ~400 chars, base64 them:
       node -e "fetch('https://xwsx.top/').then(r=>r.text()).then(h=>{
         const t=h.replace(/<script[\s\S]*?<\/script>/gi,' ')
           .replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/gi,' ')
           .replace(/\s+/g,'').slice(0,400);
         console.log(Buffer.from(t,'utf8').toString('base64'))})"
  2. python split-fonts.py   (it self-checks that no two slices overlap)
  3. Paste the printed CSS block into app/globals.css, replacing ALL old
     @font-face rules.

Note: the self-check below exists because a type bug (int set minus str set)
let every non-critical slice re-include the critical slice's chars, so the
critical slice was fully shadowed and never fetched. See the article
"chinese-font-slicing-failed" in content/articles/.
"""
import base64
import os
from fontTools.subset import Subsetter, Options, load_font

CRITICAL_B64 = "WFdTWOKAlOS/oeaIkeaJgOihjFhXU1jCt+mhueebruWFs+S6juiDveWKm+aWh+eroOiBlOezu+aIkemhueebruWFs+S6juiDveWKm+aWh+eroOi9r+S7tuW3peeoi+W4iMK35Lqn5ZOB5p6E5bu66ICFwrcyMDI25oqK5aSN5p2C55qE5oOz5rOV77yM5YGa5b6X5riF5pmw44CC5L2g5aW977yM5oiR5pivTGlubGluZ1Fp44CCWFdTWOaYr+aIkeiusOW9leS6p+WTgeOAgeS7o+eggeS4juaAneiAg+eahOS4quS6uuepuumXtO+8m+aIkeWcqOiuvuiuoeOAgeS7o+eggeS4jkFJ55qE5Lqk55WM5aSE5bel5L2c44CCY29uc3Rtb3R0bz3kv6HmiJHmiYDooYw755yL55yL5oiR5Zyo5YGa5LuA5LmIUFJPRFVDVFRISU5LSU5HU1lTVEVNU1RISU5LSU5HQ1JFQVRJVkVURUNITk9MT0dZSFVNQU4tQ0VOVEVSRURSUEFBSUFHRU5UQUlXT1JLRkxPV0FVVE9NQVRJT05QUk9EVUNUVEhJTktJTkdTWVNURU1TVEhJTktJTkdDUkVBVElWRVRFQ0hOT0xPR1lIVU1BTi1DRU5URVJFRFJQQUFJQUdFTlRBSVdPUktGTE9XQVVUT01BVElPTjAxL+eyvumAiemhueebruS4gOS6m+aKiua0nuWvn+OAgeiuvuiuoeS4juaKgOacr+i/nuaOpei1t+adpeeahOWwneivleOAguW8gOWPkeWunui3tTIwMjZTcGlkZXJLaW5n5oqK572R6aG16YeM5L6d6LWW5rWP6KeI5Zmo55qE5aSN5p2C6K+35rGC77yM5oGi5aSN5oiQ5Y+v54us56uL6L+Q6KGM44CB5Y+v6aqM6K+B55qEUHl0aG9u"

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
all_codes = set(probe.getBestCmap().keys())  # cmap 的键是整数码位
probe.close()

# CRITICAL 是字符集合，必须先转成码位再相减。
# 注意：直接写 all_codes - CRITICAL 是「整数集合减字符串集合」，
# 恒为空操作（int != str），结果是每个普通片都包含关键片的字符，
# 而 CSS 对重叠的 unicode-range 取最后声明的那条 —— 关键片会被完全遮蔽，
# 永远不会被浏览器取用。这个 bug 曾让切片方案静默失效。
critical_codes = {ord(c) for c in CRITICAL}
rest = sorted(all_codes - critical_codes)
slices = [rest[i : i + SLICE_SIZE] for i in range(0, len(rest), SLICE_SIZE)]
slices = [sorted(critical_codes & all_codes)] + slices  # slice 0 = critical

# 自检：各片的码位必须互不相交，否则关键片会被遮蔽
seen: set[int] = set()
for idx, codes in enumerate(slices):
    overlap = seen & set(codes)
    if overlap:
        raise SystemExit(
            f"切片 {idx} 与前面的片重叠 {len(overlap)} 个码位，"
            "会导致先声明的片被遮蔽，请检查 CRITICAL 与 all_codes 的计算。"
        )
    seen |= set(codes)

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
