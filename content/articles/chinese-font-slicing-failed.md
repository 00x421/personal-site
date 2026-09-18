---
title: 我把中文字体切成 21 片，首屏还是下了 383KB
description: unicode-range 分片是中文 webfont 的标准解法，我照着做了。上线后量了一次：首屏取回 13 个切片、383KB，而被设计成「首屏关键」的那一片从来没被下载过。修完之后，同一个脚本又把整站的 CSS 变量搞崩了一次。
published: 2026-09-17
tags: [前端, 性能, 字体, 调试]
series: 工程手记
---

## 中文 webfont 的尺寸问题

中文站点用衬线字体做标题，第一件事就会撞上体积。一套完整的思源宋体有二十多兆，全量减到常用的 GB2312 字符集也有几兆。任何「把整个字体文件丢进 `public/`」的做法，都会让首屏多背几秒的白屏。

常见的对策是两步：

1. **子集化**：扫描站点上的实际用字，只保留这些字，生成一份几万字节的字体。代价是新增文章时可能要重新生成。
2. **分片**：把子集再按 codepoint 切成若干块，每块用 `@font-face` 的 `unicode-range` 声明「我负责这一段码位」。浏览器下载页面时会解析页面上实际出现的字符，只取覆盖到这些字符的片。

第二步的吸引力在于它是**按需**的：首页只用了三百个不同的字，那就只下覆盖这三百个字的那几片，剩下十几片永远不进入网络请求。

## 我的实现

站点用三套字重（400 / 500 / 700）。生成脚本把每个字重切成 7 片，共 21 个 woff2 文件，输出到 `public/fonts/slices/`，同时打印一份 `@font-face` 规则供人贴进样式表。

（这是当时的形态，也是标题里「21 片」的来处。文中后面的修复把子集扩充后变成每字重 9 片、共 27 个。）

第 0 片被设计成「关键片」——脚本里叫 `CRITICAL`，收集首屏用字加 ASCII 与常用标点，单独成片，理论上应该最先需要、最该被提前加载：

```python
CRITICAL = set(base64.b64decode(CRITICAL_B64).decode("utf-8"))
CRITICAL |= set("当前待机思考中和空气小狗打招呼很高兴见聊聊天")
CRITICAL |= set(ASCII_AND_PUNCTUATION)

rest = sorted(all_chars - CRITICAL)
slices = [rest[i : i + SLICE_SIZE] for i in range(0, len(rest), SLICE_SIZE)]
slices = [sorted(ord(c) for c in CRITICAL)] + slices   # slice 0 = critical
```

`rest` 是从全量用字里**减掉** `CRITICAL` 得到的，所以按这段代码，第 0 片和后面的片之间**不应该有任何重叠**。

## 量一下

设计意图是一回事，线上是另一回事。我清掉浏览器缓存，打开首页，记录所有 `.woff2` 请求：

```
noto-serif-sc-400-s1.woff2   20628
noto-serif-sc-400-s2.woff2   29892
noto-serif-sc-400-s3.woff2   40288
noto-serif-sc-400-s4.woff2   40212
noto-serif-sc-400-s5.woff2   44132
noto-serif-sc-400-s6.woff2    9440
noto-serif-sc-500-s1.woff2   21028
noto-serif-sc-500-s2.woff2   29800
noto-serif-sc-500-s3.woff2   40292
noto-serif-sc-500-s4.woff2   40420
noto-serif-sc-500-s5.woff2   44620
noto-serif-sc-500-s6.woff2    9588
noto-serif-sc-700-s1.woff2   21396
```

**13 个请求，383KB。**

两个数字和预期不符。第一，代价是 383KB 而不是设计里那个「几十 KB 的关键片」；第二，往下看请求列表——**`s0` 一次都没出现**。三个字重，一个都没下。

那个被专门设计成首屏关键的 44KB 切片，从头到尾没被用过。

## 为什么 s0 没被下载

我写了段脚本解析样式表里全部 21 条 `@font-face`，把每条声明的 `unicode-range` 展开，然后按声明顺序统计覆盖关系。以 400 字重为例：

```
noto-serif-sc-400-s0.woff2     码位   204
noto-serif-sc-400-s1.woff2     码位   110  (109 个码位被后面覆盖)
noto-serif-sc-400-s2.woff2     码位   110  (20 个码位被后面覆盖)
noto-serif-sc-400-s3.woff2     码位   110  (24 个码位被后面覆盖)
noto-serif-sc-400-s4.woff2     码位   110  (18 个码位被后面覆盖)
noto-serif-sc-400-s5.woff2     码位   110  (13 个码位被后面覆盖)
noto-serif-sc-400-s6.woff2     码位    25  (10 个码位被后面覆盖)
```

`s1` 声明了 110 个码位，其中 **109 个已经被 `s0` 声明过**。四个字重的统计完全一致，这不是巧合。

问题在于 CSS 的解析规则：同一个字体族下有多条 `@font-face` 覆盖到同一个码位时，生效的是**最后声明**的那一条。也就是说，`s0` 声明过的字，只要后面某片又声明了一次，实际就会从后面那片取。

拿首屏标题「把复杂的想法，做得清晰。」试一下。`把`（U+628A）在 `s0` 里有，在 `s3` 里也有 → 从 `s3` 取。`清`（U+6E05）在 `s0` 和 `s4` 里都有 → 从 `s4` 取。`的`（U+7684）同理。

这正好解释了网络日志：`s3`、`s4` 被下载了，`s0` 没有。

`s0` 只在页面用到「**只有它声明过**的码位」时才会被拉取。看统计它确实还独占着一些码位，但显然首页没有用到它们——所以整个文件连同那 204 个码位的子集数据，成了死重。

## 追到生成逻辑

到这一步我的判断是：脚本里明明写了 `rest = all_chars - CRITICAL`，做了减法就不可能重叠，所以大概是「生成字体」和「贴回样式表」不是同一次操作的产物——人手工同步漏了一步。

**这个判断是错的。**

真正的原因要短得多，也蠢得多：

```python
probe = load_font("fonts-src/noto-serif-sc-500.woff2", Options())
all_chars = set(probe.getBestCmap().keys())        # ← 整数码位，如 {0x4E00, 0x4E2D, ...}
CRITICAL = set(base64.b64decode(...).decode())     # ← 字符串，如 {'一', '中', ...}

rest = sorted(all_chars - CRITICAL)                # ← 整数集合减字符串集合
```

`getBestCmap()` 返回的键是 **Unicode 码位（整数）**，而 `CRITICAL` 是从 base64 解出来的**字符串集合**。在 Python 里，`int != str` 恒成立，所以 `all_chars - CRITICAL` **一个元素都减不掉**，永远返回 `all_chars` 的全部码位。

于是 `rest` 等于「全部字符」，被切成若干片之后，**每一片都包含了关键片里的字**。而 CSS 对重叠的 `unicode-range` 取最后声明的那条——关键片就这样被后面的片全面接管，永远不会被浏览器取用。

那个减法写在那里、看起来完全正确，**没有任何报错**。它不是漏做，是做了没用。

## 一个被我自己放过的证据

回看排查过程，有一段我当时读过去了：

上面那份统计里，`s1` 声明了 110 个码位、其中 109 个被 `s0` 覆盖。**如果 `rest` 真的减掉了 `CRITICAL`，这个数字应该是 0。**

109 这个数字本身就在说「减法没生效」，但我当时的注意力全在「哪些片下载了、哪些没下载」上，把它当成了「重叠很严重」的既有事实，而不是「减法可能坏了」的信号。

我甚至写下一句自我说服的话：「脚本里明确做了减法，不可能产生这种重叠」。**把代码的意图当成了代码的行为**——这大概是调试时最贵的错觉。

## 修复

改动本身只有两行：

```python
critical_codes = {ord(c) for c in CRITICAL}   # 先转成码位
rest = sorted(all_codes - critical_codes)     # 现在减法真的生效了
```

再加一个自检，让同样的错误不可能再静默发生：

```python
seen: set[int] = set()
for idx, codes in enumerate(slices):
    overlap = seen & set(codes)
    if overlap:
        raise SystemExit(f"切片 {idx} 与前面的片重叠 {len(overlap)} 个码位")
    seen |= set(codes)
```

修复后重新生成了全部切片，并顺带按新增文章的用字扩充了子集（字形从 575 增到 1516）：每个字重 9 片，三份合计 365KB。

## 第二天，同一个脚本把整站的样式搞崩了

上面那个 bug 修完、推送上线，我以为这件事结束了。第二天刷新站点，看到的是这样：满屏颗粒、背景透明、所有颜色和字距都回到浏览器默认值——**CSS 变量全线失效**。

查下来凶手还是 `split-fonts.py`，但这次不是分片逻辑，是我用来跑它的那段临时脚本。

脚本末尾会打印一行收尾标记：

```python
print("DONE")
```

我用 Node 抓它的 stdout，按行切分，然后找那一行的下标作为 CSS 内容的结尾：

```js
const lines = out.split('\n');
const doneIdx = lines.indexOf('DONE');        // ← 在 Windows 上永远找不到
const css = lines.slice(cssStart, doneIdx).join('\n');
```

问题是 **Windows 下 Python 的输出是 CRLF 换行**，所以那一行实际是 `'DONE\r'`，而 `'DONE\r' !== 'DONE'`——`indexOf` 返回 `-1`。

`slice(start, -1)` 在 JavaScript 里是「切到倒数第一个元素为止」，**不会报错**，只是默默把倒数第一个元素留在了结果里。于是那段 CSS 变成了：

```
...U+9ED8,U+9F50;
}
DONE

:root {
```

压缩后是 `}DONE :root{--ink:#17171b;...}`。

CSS 解析器看到的选择器是 **`DONE :root`**——一个「`<DONE>` 元素里的 `<html>`」，页面上当然不存在。于是整个 `:root` 规则被当作无效规则丢弃，**里面每一个变量都没了**。

后果的分布很有意思：

| 变量 | 失效后 |
|---|---|
| `--noise-opacity` | `opacity: var(--noise-opacity)` 无效 → 回退到初始值 **1** → 满屏颗粒 |
| `--paper` | body 背景变透明 |
| `--tracking-cjk-display` | 中文标题的字距回归默认 |
| 其余颜色 | 全部失效 |

一个词（`DONE`）混进去，整个站点的视觉系统归零。

## 两个 bug，同一个形状

回过头看，这两个 bug 是同一件事的两面：

|  | 第一个 bug | 第二个 bug |
|---|---|---|
| 代码写的 | `all_chars - CRITICAL`（减法） | `lines.indexOf('DONE')`（查找） |
| 实际行为 | int 集合减 str 集合 → 减不掉 | 找 `'DONE'` 但实际是 `'DONE\r'` → 找不到 |
| 失败方式 | 返回原集合，不报错 | 返回 -1，不报错 |
| 我为什么没发现 | 「脚本里明确做了减法，不可能重叠」 | 「Deploy 成功、字体请求正常」 |

**两个都是「代码写了意图，运行给出另一个结果，而中间没有任何提示」。** 而两次我都是用**推理**代替了**验证**——第一次推理「减法不可能失效」，第二次部署后只检查了「我改的东西」（字体请求、字形渲染），没检查「页面整体还正常吗」。

第二个 bug 更值得记的教训在这里：**我验的是我改的部分，不是系统**。字体确实修好了（这是真的），但同时我打坏了样式表（这也是真的）。如果部署后截一张图，问题当场就会看到。

## 修法：让这类错误不可能发生

这次没有停在「修好了」。两个改动：

**一、脚本直接改写样式表，不再有人解析它的输出。**

样式表里给字体块加了标记：

```css
/* @font-faces:start */
@font-face { ... }
/* @font-faces:end */
```

`split-fonts.py` 现在自己读文件、替换标记之间的内容、写回：

```python
start = source.find(START_MARK)
end = source.find(END_MARK)
if start == -1 or end == -1 or end < start:
    raise SystemExit(f"{CSS_FILE} 里找不到标记，未做修改。")
updated = source[:start] + block + source[end + len(END_MARK):]
```

读写都指定 `encoding="utf-8"` 和 `newline=""`，保留原有换行。这样「脚本输出 → 人/工具搬运」这一环被整个删掉了——**那个环节本来就不该存在**。

**二、两道自检。**

```python
# 分片码位不得相交
seen: set[int] = set()
for idx, codes in enumerate(slices):
    if seen & set(codes):
        raise SystemExit(f"切片 {idx} 与前面的片重叠")

# 写入后不得出现收尾文本
for stray in ("DONE", "Traceback"):
    if stray in updated:
        raise SystemExit(f"{CSS_FILE} 里出现了意外的 {stray}，请检查。")
```

第二道自检专门盯着这次的失误：**如果脚本的收尾文本混进了页面内容，就别让它安静地过去。**

## 教训

这个优化失效了将近两周，没有任何报错、没有任何告警、Lighthouse 也不会有意见——它只是安静地多下了 300 多 KB。**性能优化如果不配一个能重复执行的测量，就跟没做差不多**，因为你无法区分「按设计工作」和「完全没生效」。

比这更值得记的是我判断错的那一步。当时的推理链是「代码写了减法 → 减法不可能失效 → 一定是流程问题」，而正确的做法是**直接验证那个减法**——打印一下 `len(all_chars)` 和 `len(rest)`，两个数字相等，问题当场就暴露了。

而第二天那个 `DONE` 说明，这类错误不会因为你刚修过一个就放过你。它们来自同一个习惯：**信任代码的意图，而不是它的输出**。真正的防线不是「写得更小心」，而是让每一步的结果都有人能看见——断言、标记、截图、一个能重复跑的数字。

凡是靠「我确信这里没问题」来跳过的地方，都该有一条断言替你把关。

至于眼下这二十多个分片，真正该回答的问题其实更靠前：一个以中文字为主的站点，值不值得为衬线标题加载三套字重、二十多个分片的定制字体？如果答案是「值」，那分片要修对；如果「不值」，那更省事的做法是用系统自带的衬线字体兜底，把这份预算留给别的地方。
