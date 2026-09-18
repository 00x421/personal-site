"""Split subsetted Noto Serif SC woff2 into unicode-range slices.

Input: fonts-src/noto-serif-sc-{400,500,700}.woff2 (site-char subsets,
NOT in git - regenerate with subset-fonts.py).
Critical slice = first-screen chars + ASCII/punct; remaining chars split
~110/char-slice. Font files land in public/fonts/slices/; the @font-face
rules are written **directly** into app/globals.css between the
`@font-faces:start` / `@font-faces:end` markers.

Re-run when site copy changes:
  1. Refresh CRITICAL_B64 below. Easiest reliable way: base64 the first
     ~400 visible chars of the live homepage (one-liner in the article).
  2. python split-fonts.py
        - rewrites the font slices
        - rewrites app/globals.css between the markers
        - self-checks: no two slices may overlap, and no trailing script
          output may leak into the stylesheet
  3. Rebuild.

Note: two guards here exist because both failure modes actually happened.
  a) A type bug (int set minus str set) let every non-critical slice
     re-include the critical slice's chars, so the critical slice was fully
     shadowed and never fetched.
  b) Parsing this script's stdout once leaked the trailing line into the
     stylesheet, which merged with `:root` into a selector matching nothing
     and silently killed every CSS variable (live outage).
Both are written up in content/articles/chinese-font-slicing-failed.md.
"""
import os
import re
from fontTools.subset import Subsetter, Options, load_font

# ---------------------------------------------------------------- 关键片字符集
#
# 三个字重在首页承担的角色差别很大，共用一个集合会让 w400/w700 的关键片
# 白白多出上百个字形：
#   w400 → hero 的强调行（.hero h1 em）与页脚署名，十几个字
#   w500 → 首页绝大部分衬线标题（区块标题、项目名、文章标题、能力名、CTA）
#   w700 → 只有品牌字标
#
# 采集方式：打开线上首页，按字重取所有 font-family 含 Noto Serif SC 的可见文本。
# 浏览器控制台一行即可（.nav-buddy 气泡与搜索面板用的是无衬线栈，不计入）：
#
#   (() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
#     const m = {}; let n; while ((n = w.nextNode())) { const e = n.parentElement; if (!e) continue;
#     const c = getComputedStyle(e); if (!c.fontFamily.includes('Noto Serif SC')) continue;
#     if (!n.textContent.trim()) continue; (m[c.fontWeight] ??= new Set());
#     for (const ch of n.textContent) if (ch.trim() && ch.codePointAt(0) > 127) m[c.fontWeight].add(ch); }
#     for (const k in m) console.log(k, [...m[k]].join('')); })()
#
# 注意：新增文章会改变首页 02 区的标题用字。若新标题含 w500 集合之外的字，
# 浏览器会为那几个字额外拉一个切片 —— 脚本末尾的校验会就此发出警告。
CRITICAL_BY_WEIGHT = {
    "400": "想法，做得清晰。©·信我所行",
    "500": (
        "一起把它变成现实。把复杂的精选项目个人站技术文章我中字体切成片，首屏还是下了"
        "标题不该套用拉丁负距和搭然后跑在台服务器上说「操作功完」却件都没删关于相信好数"
        "产品应既聪明也有味能做什么自动化方案与拆解全栈实现验起变"
    ),
    "700": "·",
}

# 每个字重都要带的 ASCII 与常用标点（品牌字标 XWSX、年份、CTA 的邮箱等都是 ASCII）
PUNCTUATION = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,;:!?'\"()-\u2014\u2013_/\\@#$%&*+=<>[]{}|~^`"
    "\u3000\u3001\u3002\uff0c\uff1a\uff1b\uff1f\uff01\uff08\uff09"
    "\u201c\u201d\u2018\u2019\u300a\u300b\u2014\u2026\u00b7"
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

# cmap 的键是整数码位。读 500 字重即可：三份子集来自同一套站点用字，
# 覆盖范围相同（差异只在字形，不在码位）。
probe = load_font("fonts-src/noto-serif-sc-500.woff2", Options())
all_codes = set(probe.getBestCmap().keys())
probe.close()

punct_codes = {ord(c) for c in PUNCTUATION}


def build_slices(weight: str) -> list[list[int]]:
    """按字重切分：第 0 片是关键片，其余每片 SLICE_SIZE 个码位。"""
    # CRITICAL 是字符集合，必须先转成码位再相减。
    # 直接写 all_codes - CRITICAL 是「整数集合减字符串集合」，恒为空操作
    # （int != str），结果每片都包含关键片的字符，而 CSS 对重叠的
    # unicode-range 取最后声明的那条 —— 关键片会被完全遮蔽、永不加载。
    # 这个 bug 曾让整个切片方案静默失效。
    critical = punct_codes | {ord(c) for c in CRITICAL_BY_WEIGHT[weight]}
    critical &= all_codes

    rest = sorted(all_codes - critical)
    chunks = [rest[i : i + SLICE_SIZE] for i in range(0, len(rest), SLICE_SIZE)]
    slices = [sorted(critical)] + chunks

    # 自检：各片码位必须互不相交，否则先声明的片会被遮蔽
    seen: set[int] = set()
    for idx, codes in enumerate(slices):
        overlap = seen & set(codes)
        if overlap:
            raise SystemExit(
                f"weight {weight} 的第 {idx} 片与前面的片重叠 {len(overlap)} 个码位，"
                "会导致先声明的片被遮蔽，请检查关键片与 all_codes 的计算。"
            )
        seen |= set(codes)
    return slices


def content_hash(data: bytes) -> str:
    """文件名里的内容指纹。

    加它才能把缓存设成 immutable —— 内容一变文件名就变，
    浏览器不必按小时回源校验。
    """
    import hashlib

    return hashlib.sha256(data).hexdigest()[:8]


css = []
total = {}
expected_files: set[str] = set()

for weight in WEIGHTS:
    src = f"fonts-src/noto-serif-sc-{weight}.woff2"
    slices = build_slices(weight)
    for idx, codes in enumerate(slices):
        tmp = os.path.join(OUT_DIR, f"_tmp-{weight}-{idx}.woff2")
        subset_to(src, codes, tmp)
        with open(tmp, "rb") as f:
            data = f.read()
        name = f"noto-serif-sc-{weight}-s{idx}.{content_hash(data)}.woff2"
        dest = os.path.join(OUT_DIR, name)
        os.replace(tmp, dest)
        expected_files.add(name)
        total[name] = len(data)
        css.append(
            "@font-face {\n"
            "  font-family: 'Noto Serif SC';\n"
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/slices/{name}') format('woff2');\n"
            f"  unicode-range: {ranges(codes)};\n"
            "}"
        )

# 删除上一轮留下的切片（文件名带哈希，内容一变就会积累）
for existing in os.listdir(OUT_DIR):
    if not existing.endswith(".woff2") or existing in expected_files:
        continue
    os.remove(os.path.join(OUT_DIR, existing))
    print(f"移除旧切片: {existing}")

# 校验：会上首页的文章/项目标题，其用字应在 w500 关键片内，
# 否则首页会为那几个字额外拉一个切片。draft 的内容不出现，跳过。
title_chars: set[str] = set()
for root in ("content/articles", "content/projects"):
    if not os.path.isdir(root):
        continue
    for fname in os.listdir(root):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(root, fname), encoding="utf-8") as f:
            head = f.read(1200)
        if re.search(r"^draft:\s*true", head, re.M):
            continue
        m = re.search(r"^title:\s*(.+)$", head, re.M)
        if m:
            title_chars.update(c for c in m.group(1) if ord(c) > 0x7F)
missing = sorted(title_chars - set(CRITICAL_BY_WEIGHT["500"]))
if missing:
    print(
        "⚠ 以下标题用字不在 w500 关键片内，首页会额外拉取切片：\n"
        f"   {''.join(missing)}\n"
        "   如需纳入，请按脚本头部说明重新采集 CRITICAL_BY_WEIGHT。"
    )

for weight in WEIGHTS:
    w_total = sum(v for k, v in total.items() if f"-{weight}-s" in k)
    n = len([k for k in total if f"-{weight}-s" in k])
    print(f"weight {weight}: {n} 片, {w_total/1024:.0f} KB")
print(f"关键片: w500 {total[[k for k in total if '-500-s0' in k][0]]/1024:.1f} KB, "
      f"w400 {total[[k for k in total if '-400-s0' in k][0]]/1024:.1f} KB, "
      f"w700 {total[[k for k in total if '-700-s0' in k][0]]/1024:.1f} KB")

# 直接改写 app/globals.css 里两个标记之间的内容。
#
# 以前是把 CSS 打到 stdout 再由人工/脚本粘贴，结果踩过两次坑：
#   1. 脚本按 "\n" 切分 stdout 找结尾标记，而 Windows 下 Python 输出是 CRLF，
#      匹配失败，把收尾那行文本一并当成 CSS 写进了文件；
#   2. 压缩后那段文本与 :root 拼成一个匹配不到元素的选择器，
#      整个 :root 规则被丢弃，全站 CSS 变量失效（线上故障）。
# 改成脚本直接落盘后，不再有「解析 stdout」这一步。
CSS_FILE = os.path.join("app", "globals.css")
START_MARK = "/* @font-faces:start */"
END_MARK = "/* @font-faces:end */"

block = START_MARK + "\n" + "\n".join(css) + "\n" + END_MARK

with open(CSS_FILE, encoding="utf-8", newline="") as f:
    source = f.read()

start = source.find(START_MARK)
end = source.find(END_MARK)
if start == -1 or end == -1 or end < start:
    raise SystemExit(f"{CSS_FILE} 里找不到 {START_MARK} / {END_MARK} 标记，未做修改。")

updated = source[:start] + block + source[end + len(END_MARK):]
with open(CSS_FILE, "w", encoding="utf-8", newline="") as f:
    f.write(updated)

print(f"已写入 {CSS_FILE}：{len(css)} 条 @font-face 规则")

# 生成关键片清单，供 app/layout.tsx 输出 <link rel="preload">。
#
# 为什么需要它：vinext 的字体 preload 只走 HTTP Link 头，而 next.config.ts 里
# `reactMaxHeadersLength: 0` 会把 Link 头整体关掉（那个设置是为了消除图片的
# preload 警告，见该文件的注释）。所以字体 preload 必须由 layout 手写 HTML 标签。
# 文件名带内容哈希，只能由本脚本产出，不能硬编码在 layout 里。
GEN_FILE = os.path.join("lib", "font-slices.generated.ts")
critical = []
for weight in WEIGHTS:
    hit = next((k for k in total if f"-{weight}-s0." in k), None)
    if hit:
        critical.append((weight, f"/fonts/slices/{hit}"))

with open(GEN_FILE, "w", encoding="utf-8", newline="\n") as f:
    f.write(
        "// 由 split-fonts.py 生成，请勿手工编辑。\n"
        "// 首屏关键片：每个字重第 0 片，覆盖首页可见的衬线文字。\n"
        "// layout.tsx 用它们输出 <link rel=\"preload\">，让字体与 CSS 并行下载。\n"
        "export const criticalFontSlices = [\n"
        + "".join(
            f"  {{ weight: {w}, href: '{href}' }},\n" for w, href in critical
        )
        + "] as const;\n"
    )
print(f"已写入 {GEN_FILE}：{len(critical)} 个关键片")
kb = sum(total[k] for k in total if "-s0." in k) / 1024
print(f"关键片合计 {kb:.1f} KB（这些字节首屏本来就要下载，preload 不产生额外流量）")

# 自检：替换后文件里不应出现任何收尾标记类的裸词
for stray in ("DONE", "Traceback"):
    if stray in updated:
        raise SystemExit(f"写入后 {CSS_FILE} 里出现了意外的 {stray}，请检查。")

