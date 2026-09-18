# 迭代路线

> 面向接手人与未来的自己：**已交付的改动**与**待办清单**。日常操作见 [README.md](./README.md)，架构与踩坑见 [HANDOFF.md](./HANDOFF.md)。

本文件在 2026-09-17 的一次线上质量评审后建立。评审基于实测数据（浏览器测量 + 源码通读），不是主观印象。

---

## 已交付：第 1 批（2026-09-17）

围绕「观感与可用性」，四组改动一次性交付。

### 迭代 1 · 中文排版字距修正

**问题**：hero 标题 `letter-spacing: -0.075em`，在 112px 字号下等于 **−8.4px**。「想法**，**」「清晰**。**」的全角标点被完全挤没，字形互相碰撞。

**根因**：负字距是**拉丁字母**的排版习惯——拉丁字形自带侧边空白（side bearing），收紧才显得整齐。汉字是满 em 方框，同样的负值会先撞字形、再吃掉全角标点的呼吸感，而标点留白正是中文排版的节奏来源。字体分片已保留 `kern` 特性（`split-fonts.py` 的 `layout_features`），负 `letter-spacing` 是在此基础上再硬压。

**改动**：`app/globals.css` 引入两个变量，把意图写进代码：

| 变量 | 值 | 用于 |
| --- | --- | --- |
| `--tracking-cjk-display` | `-0.03em` | 展示级中文标题（hero / CTA / 页级大标题 / 案例 h3） |
| `--tracking-cjk-heading` | `-0.02em` | 小节级中文标题（卡片标题 / 列表标题 / 案例 h4） |

**刻意保留强收紧**的纯拉丁标题：`.brand`（−2px）、`.project-copy h3`（−0.05em）、`.case-title-row` 系列（−0.08em）——项目名是 Spider King / Flowbase / Atlas Studio，英文收紧是对的。装饰性巨号数字 `.project-symbol::after`（−0.12em）同理保留。

**验收**：hero 全角逗号／句号左右恢复可见间隙（实测 −8.4px → −3.36px）。

### 迭代 2 · 可读性与触控目标

**问题**：首页 69 个元素字号 ≤11px，其中 17 个 9px。`.article-tags` chip 实测 **52×21px**，而它在文章详情页是 `<Link>` —— 违反 WCAG 2.2 SC 2.5.8（≥24 CSS px）。Lighthouse 不查这条，所以 a11y 100 分与这个问题并存并不矛盾。

**原则**：装饰性小字保留，内容性小字提上来。

| 选择器 | 前 → 后 |
| --- | --- |
| `.article-tags span/a` | 9px / 21px 高 → **11px / `min-height: 24px`** |
| `.project-top` / `.project-foot` | 10px → **11px** |
| `.project-foot span` | 9px → 继承 11px（去掉字号覆盖） |
| `.case-meta span` / `.case-deliverables span` | 10px → **11px** |
| `.article-tag-cloud a` | 补 `min-height: 24px`，计数徽章 9px → 10px |

**未动**（刻意）：`.section-index`、`.eyebrow`、`.article-number`、`.case-eyebrow` 等 **11px 大写宽字距序号**——这是编辑风设计语言的一部分，且非交互元素。

**触屏增强**（`@media (pointer: coarse)`）：chip 提到 44px；文本型链接（`.back-link` / `.not-found-actions` / `.now-actions` / `.site-footer a`）用 `::after { inset: -11px -8px }` **扩大命中区而不推离下划线**——直接加 padding 会让 `border-bottom` 远离文字，这是取舍点。

### 迭代 3 · 版面构图

| 位置 | 问题（实测） | 改动 |
| --- | --- | --- |
| `.cta` | 标题横向只占 **42%**，右上约 55% 是空紫色场；按钮仅 232×32 | 标题单独一档字号 `min(clamp(54px, 10.5vw, 152px), calc((100vw - 120px) / 4.65))` → 占比 **57%**；按钮 232×32 → **268×44**；padding 70 → 58 |
| `.about` | 左栏内容 444px、右栏肖像 642px，结尾 CTA 悬在半空，底部差 **198px** | 左栏改 flex column + 链接 `margin-top: auto` → 两栏同时收尾（实测 linkBottom === portraitBottom） |
| 案例页年份 | `.case-title-row` 的 `space-between` 把年份推到 ~600px 外成孤字 | 移到 `.case-hero-top` 与眉标同行，呼应文章页「meta 在标题之上」的模式 |

> `.cta h2` 的字号守卫用 `4.65` 是因为该区最长行 **5 字**（hero 是 7 字，用 `6.5`）。改文案行数时记得同步这个除数。

### 迭代 4 · 内容正确性与健壮性

1. **`getRelated` 排除反向链接**：`/articles/build-small-systems` 的「相关阅读」与「链接到本文」原本渲染同一篇。现在 `getRelated` 会过滤掉正文里链接到本文的文章（`data/articles.ts`）。
2. **新增 `app/error.tsx` + `app/global-error.tsx`**：原先 RSC 抛错直接落到框架默认页。`error.tsx` 沿用 404 的编辑风与空气小狗，并利用客户端的 `reset()` 提供「重试一次」；`global-error.tsx` 会替换整个 `<html>`/`<body>`（全局样式未必生效），所以**全部走内联样式**且不依赖任何 class。

### 迭代 4 附赠 · frontmatter 引号 bug（评审时发现）

**问题**：首屏项目卡的巨型装饰数字渲染成 **`'01'` / `'03'`**（带引号），卡片与案例页年份显示 **`'2026'`**。

**根因**：`lib/markdown.ts` 的 `splitFrontmatter` 对标量值**不做引号剥离**，而同一个函数处理块列表时却会剥离——行为不一致。内容里写 `year: '2026'` 是合理的 YAML 风格，解析器应当容忍。

**改动**：新增 `unquote()`（只处理**首尾成对**的引号，`it's` 这类内含引号的值不受影响），应用到 `splitFrontmatter` 的标量、块列表项，以及 `list()` / `parseTags()`；`data/books.ts` 的独立解析器同步跟进。

### 附赠 · 文档修复

`README.md` 有 3 行中文被编码事故损坏成 `??????`（**源头比 `8d2e15b` 更早**，仓库历史里没有干净版本可还原），已按 HANDOFF 的对应描述重建；同时把首段「部署目标是 Cloudflare Workers」更正为实际的自托管架构，并补上 ROADMAP 入口。

---

## 已交付：第 2 批（2026-09-17，清理与修复）

内容治理（攒下 3 篇占位文章、2 个占位项目）与 CTA 改版之后，做了一轮全量清理，顺手卷出几个真问题：

### 字体子集重新生成（修复字形缺失）

新文章的字不在旧的字体子集里——实测文章标题 24 个字形中 **2 个字从访客本机取**（`片`、`屏`），是明显的字体回退瑕疵。

重生流程（`subset-fonts.py` 的输入是完整 OTF，子集靠 `%TEMP%/site-chars.txt` 指定）：

1. 下载三个完整 OTF（11MB × 3）到 `%TEMP%/noto-src/`
2. 收集站点用字（991 个非 ASCII）写入 `%TEMP%/site-chars.txt`
3. `python subset-fonts.py` → 产物写 `public/fonts/`，**需手动移到 `fonts-src/`**（脚本的 OUT_DIR 与 split 的输入目录不一致，是个小坑）
4. `python split-fonts.py` → 分片写入 `public/fonts/slices/`，stdout 输出 `@font-face` 块
5. 把该 CSS 块替入 `app/globals.css`（替换旧的即可）

**结果**：字形 575 → 1516，每字重 9 片、三份合计 365KB。

### `split-fonts.py` 的类型 bug（这是「分片从未生效」的真正根因）

`getBestCmap()` 返回整数码位，而 `CRITICAL` 是字符串集合——`all_chars - CRITICAL` 是「int 集合减 str 集合」的恒空操作。已修为先转码位再相减，并加了「任两片相交即 `SystemExit`」的自检。详见 `content/articles/chinese-font-slicing-failed.md`。

### OG 分享图

- 3 篇新文章 + 1 个新项目的图缺失（分享链接会裂图）→ 已生成
- `generate-og.ts` 的**项目部分漏了 `draft` 过滤**（文章部分有）→ 已修
- 新增 `removeOrphans()`：生成时删掉已不存在内容的旧图，避免 `public/` 里持续积攒废弃资产

---

## 已交付：第 3 批（2026-09-18，性能优化）

一次针对实测数据的优化。所有数字都来自浏览器 `Performance` API（禁用缓存加载首页），同口径可比。

### 优化前的账（首屏传输 1,038 KB）

| 类型 | 传输 | 占比 |
| --- | --- | --- |
| 字体 | 511 KB | 49% |
| JS | 211 KB | 20% |
| 图片 | 193 KB | 19% |
| RSC 数据 | 26 KB | 3% |
| CSS | 16 KB | 2% |

字体占了一半，所以从这里开始。

### ① 字体关键片已过期（511 KB → 97 KB）

首页实际只需要 **108 个衬线字符**（w500 99 个 + w400 14 个 + w700 1 个，由浏览器按字重采集），却下载了 12 个切片。

根因不在切片算法，而是**关键片的字集来自旧首页**：99 个首页字符里只有 40 个命中，其余 59 个散落在 s1–s8，每个都要拉一整个切片。

```
不在关键片的 59 个字：
  站字体切片首屏还下了标题不该套用拉丁负距搭然后它跑台服务上
  说「操功完」却都没删相数应既聪明也有味自动化方案拆解全栈现变
```

**修法**：`split-fonts.py` 的 `CRITICAL_BY_WEIGHT` 按字重分别定义关键片——三个字重在首页承担的角色差别很大，共用一个集合会让 w400/w700 白背上百个字形（实测：共用 159.7 KB，分离 95.7 KB）。

**结果**：3 个切片 / 97 KB。脚本末尾会校验「会上首页的标题用字是否都在 w500 关键片内」，缺字时给出警告。

> 走过一条弯路：我先假设问题是「切片按码位排序，字符在 Unicode 区块里散开」，模拟了按频率重排的方案——**实测没用**（17 片 → 15 片）。因为首页需要 108 字（占站点 10.7%），这么高的比例下任何排序都会触及大部分切片。没做那个对照实验的话，会去写一个复杂得多、效果还更差的方案。

### ② 客户端包里的 Markdown 解析器（84 KB → 2.6 KB）

`project-explorer` 是 `'use client'` 组件，却直接 `import { projects } from '@/data/projects'`。那个模块用 eager 的 `import.meta.glob('?raw')` 把全部 Markdown 原文内联，于是**访客为了看首页的筛选栏，要下载 marked、prismjs 和所有案例全文**。

拆开后：客户端只接收卡片字段（props），类型定义留在组件文件里。`project-explorer` chunk 从 84 KB 降到 2.6 KB，客户端 JS 总量 566 → 484 KB。

> 这是会随内容增长而恶化的结构问题——每新增一个项目案例，它的全文都会进客户端包。现在永久解决。

### ③ 吉祥物图片（291 KB → 36 KB）

4 张小狗图会随状态轮播（每 6 秒一次），所以**全部都会被加载**，合计 291 KB。原始是 256×256 PNG，而渲染尺寸只有 54×54（3x DPR 需要 162px）。

`scripts/optimize-pup-images.py`：缩到 192×192 转 WebP，合计 35.6 KB。`npm run images`。

肖像图（151 KB）**没动**——它是手绘质感图，重编码到 q78 只省 6%，用主视觉的画质换 9 KB 不划算。这是权衡后放过的一项。

### ④ 字体 preload（0 → 3 条）

产出 HTML 里此前**没有任何字体 preload**。原因见 HANDOFF：vinext 的字体 preload 只走 HTTP Link 头，而 `reactMaxHeadersLength: 0` 把 Link 头整体关掉了。

`split-fonts.py` 现在额外生成 `lib/font-slices.generated.ts`（关键片清单，文件名带哈希，不能硬编码），`layout.tsx` 用 `react-dom` 的 `preload()` 输出。

> **踩坑**：一开始手写 `<link rel="preload">`，结果输出了 6 条——React 19 会把 `<link>` 自动提升进 `<head>`，手写进 head 就会与提升的版本重复。改用 `preload()` API 后是 3 条。这三个切片覆盖首页所有衬线文字，字节本来就要下载，不增加流量。

### ⑤ 缓存与 nginx（重复访客省 ~700 KB）

| 资源 | 改前 | 改后 |
| --- | --- | --- |
| HTML | 无 `Cache-Control` | `no-cache`（每次重验）|
| CSS / JS（哈希名）| 1 年 immutable | 1 年 immutable（不变）|
| **字体切片**（现在是哈希名）| **1 小时** | **1 年 immutable** |
| 图片 | 1 小时 | 1 周 |
| `/rss.xml`、`/search.json` | 1 小时 | 原样放行（各自带缓存头）|

nginx 侧：
- `/_next/static/` 与 `/fonts/slices/` 改为 `alias` **直服**（不过 Node）
- 静态文件 location 用 `try_files $uri @app` 回落到应用，而不是 `=404`
- HTML 的 `no-cache` 用 `map $upstream_http_cache_control` 判断，只在上游没给缓存头时添加，避免覆盖接口自己的策略

> **两个坑**：
> 1. `/home/xwsx` 原本是 750，nginx（www-data）进不去 → 直服全部 404。改成 711（可穿越、不可列目录）。
> 2. 静态文件写成 `try_files $uri =404` 会让 `/robots.txt` 变 404——它是应用动态生成的，不在 `public/` 里。改 `@app` 回落解决。

### 优化后的账

| 类型 | 改前 | 改后 |
| --- | --- | --- |
| 字体 | 511 KB（12 个）| **97 KB（3 个）** |
| JS | 211 KB | **178 KB** |
| 图片 | 193 KB | **158 KB** |
| CSS | 16 KB | 17 KB |
| RSC | 26 KB | 26 KB |
| **合计** | **1,038 KB** | **476 KB（−54%）** |

### 回访实测

上面是首次访问。缓存策略要验证的是**第二次**：

| | 资源数 | 命中缓存 | 实际传输 |
| --- | --- | --- | --- |
| 首次 | 31 | — | 476 KB |
| 回访 | 31 | **28** | **26 KB（−96%）** |

那 26 KB 是两个 RSC 预取请求（`/projects/...?_rsc=`），它们没有缓存头，属于预期行为。字体、CSS、JS、图片全部命中。

> **测量坑**：第一次测回访时得到「31 个资源全部重新下载」，差点误判成缓存失效。原因是早前用 CDP 设过 `Network.setCacheDisabled(true)`，**这个状态会留在 page target 上**，后续新建 CDP session 再设回 `false` 也不一定恢复。换一个全新页面、完全不碰 CDP 重测，才是真实结果。

另：控制台零错误零警告，3 条字体 preload 无重复，明暗双主题与 390px 移动端均验证通过。

---

## 迭代 4 批 · 测试与结构（已完成并上线）

这一批不加功能，只做两件事：**把不可测的代码变成可测的，然后把测试写出来**。

### 为什么之前一行测试都没有

不是没想到，而是**结构上测不了**。查询逻辑（相关阅读、上下篇、反向链接、标签统计）全部长在 `data/articles.ts` 里，而那个文件用 `import.meta.glob` 在构建期内联 Markdown 原文——只有 Vite 环境能跑，Node 测试进程碰不了。想测就得先拆。

### 拆法：把「文章从哪来」和「怎么查」分开

| 模块 | 职责 | 依赖 |
| --- | --- | --- |
| `lib/content-parse.ts` | frontmatter 解析、阅读时长、XML 转义 | **零依赖** |
| `lib/article-queries.ts` | 所有集合查询，签名统一为 `(articles, ...)` | 运行时零 import |
| `data/articles.ts` | 只负责 `import.meta.glob` 加载 + 排序，然后转发 | Vite |
| `data/books.ts` | 只负责加载，解析复用 `content-parse` | Vite |

`lib/article-queries.ts` 里的 `Article` 用 `import type` 引入，编译期即被擦除，所以这个模块运行时**一个 import 都没有**——测试加载它不需要 marked、不需要 prismjs、不需要 Vite。

顺带清掉三处重复实现：
- `data/books.ts` 自己写的 frontmatter 解析器（与 `lib/markdown.ts` 会静默漂移，上次修引号 bug 就是两处一起改的）
- `data/articles.ts` 里的 `list()` 与 `parseTags()` 逻辑几乎完全相同，统一为 `parseList()`
- `app/rss.xml/route.ts` 里的一份 `escapeXml()`

### 测试

`npm test` → `node --experimental-strip-types --test "tests/*.test.ts"`，**零新依赖**，76 个用例。

`tests/content-parse.test.ts`（34 个）：引号剥离、CRLF、无 frontmatter、只有 frontmatter、块列表、冒号切分、注释剥离、阅读时长边界、XML 转义顺序。

`tests/article-queries.test.ts`（42 个）：排序、上下篇边界、相关阅读打分与回退、标签筛选与计数、反向链接、系列正序，以及对每个函数的**入参不可变性**检查。

### 写测试时发现的三件事实

测试的价值不只在回归，还在于**把口头约定变成可执行的断言**。这三个都是写断言时才发现原来不是我以为的那样：

1. **`findRelated` 的 `max` 是上限，不是目标。** 只要存在标签重叠，就只返回重叠的那些，**不拿无关文章补齐**。所以「相关阅读」在只有一篇相关文章时只显示一张卡。这是刻意的「宁缺毋滥」，但现在它是一条测试，不是一段注释。
2. **`estimateReadTime` 把换行和空格也算作字数。** 只有 Markdown 语法字符（`# > * ` ~ _ [ ] ( ) ! | -`）被剔除，空白没有。所以空行多、小标题多的文章会被轻微高估。
3. **`collectTags` 对同一篇文章里的重复标签会重复计数。** `tags: [前端, 前端]` 会计为 2。当前内容里没有这种情况，暂不修。

后两条都**保持现状、只锁行为**——重构不该顺手改用户可见的结果（阅读时长、标签计数都是页面上看得见的数字）。已列入下方待办。

同理，`sortByNewest` **刻意不加 slug 兜底**：本站有三篇同日发布的文章，原来的顺序依赖输入顺序（`sort` 稳定所以可复现），加第二排序键会改变「上一篇 / 下一篇」的走向。

### 验证

- `npm test` 76/76 通过
- `npx tsc --noEmit` 零错误
- `npx oxlint` 0 warnings 0 errors（`tests/**` 关掉了 `no-floating-promises`，因为 `node:test` 的 `describe`/`it` 返回 Promise 是设计如此）
- 线上实测：文章列表顺序、阅读时长、标签计数、上下篇、RSS 4 条、search.json 8 条、书籍页、案例页交付物——**均与重构前一致**，控制台零错误

---

## 待办

### 小修正（行为变更，需单独确认）

- **`estimateReadTime` 把空白算进字数**：剔除空白后重算会普遍降 1 分钟（长文尤甚）。值不值得动，取决于你更在意「估得准」还是「数字稳定」
- **`collectTags` 重复标签重复计数**：`new Set(article.tags)` 一行可修，当前内容没有触发
- **同日文章的排序**：给 `sortByNewest` 加 slug 第二排序键可让顺序不再依赖文件枚举顺序，代价是「上一篇 / 下一篇」的走向会变一次

### 已知但暂不处理

- **框架 JS 535KB**（React 186 + vinext 130 + 业务 112）：vinext beta 固有成本，等稳定版
- **`globals.css` 2368 行单文件**：注释与分区做得不错，可读性尚可，但无法 tree-shake。按关注点拆分（typography / rails / article / theme）优先级低
- **肖像图**：`personal-portrait-scribble.webp` 151KB。它是手绘质感图，重编码到 q78 只省 6%——用主视觉的画质换 9 KB 不划算，权衡后放过
- **`.cta` 右上空场**：放大标题后从 55% 降到 43%，仍是一块不对称色场。可视为海报式的刻意留白；若要进一步收，需重新组织文案或加装饰，不建议无设计输入时动手
- **`text-spacing-trim`**：现代 CSS 有 `text-spacing-trim: trim-start` 可自动收全角标点前侧空白，但目前仅 Chrome 支持，暂不引入

---

## 改动后的验收基线

改完代码后按 HANDOFF 的「本地验证工作流」执行，并确认：

- [ ] `npm run lint` 零告警（`components/ui` 的 shadcn 模板既有告警除外）
- [ ] `npm test` 全绿
- [ ] `npm run build` 通过（CI 同款）
- [ ] 浏览器 console 零警告，明暗两主题正常
- [ ] **看一眼页面截图**（见下）
- [ ] 移动视口（390px）无横向溢出，chip 与文本链接的命中区正常
- [ ] 中文标题的全角标点在明暗两主题下都有可见间隙
- [ ] 改 `.cta h2` / `.hero h1` 的文案行数时，同步更新字号守卫的除数（见迭代 3）

### 为什么「看一眼截图」是单独一条

2026-09-18 出过一次线上故障：`split-fonts.py` 收尾打印的 `DONE` 被解析脚本误当成 CSS 内容写进样式表，压缩后与 `:root` 拼成选择器 `DONE :root`——匹配不到任何元素，于是**整块 CSS 变量被丢弃**（`--noise-opacity` 失效使 `opacity` 回退到 1，满屏颗粒；`--paper` 失效使背景透明）。

当时我验了字体请求、CDP 字形、OG 图片——**每一项都验证了「我改的东西」，却没验证「页面整体还正常吗」**。而这类结构性错误，一张截图就能发现。

教训：**验收要看着产出，不是看着变量**。「我改的部分没报错」不等于「系统没被我弄坏」。凡是改动涉及以下任一项，都该截图复核：

- 样式表的结构（不只是某个属性值）
- 构建/部署脚本
- 任何会改写源文件的工具

### 相关：工具链里的静默失败清单

这个项目已经踩过三次「不报错但也没生效」的坑，它们形状相同：

| 位置 | 代码的意图 | 实际行为 |
| --- | --- | --- |
| `fs.rmSync` 递归删除 | 删掉 dist | 路径含非 ASCII 时静默失败（errno 0）；已用 `scripts/clean-dist.mjs` 替代 |
| `split-fonts.py` 减法 | `all_chars - CRITICAL` | int 集合减 str 集合 = 空操作；已修为先转码位，并加重叠自检 |
| 分片 CSS 的落盘 | 取出脚本输出的 CSS 部分 | CRLF 使结尾标记匹配失败，收尾文本混进样式表；已改为脚本直接改写标记之间的内容 |
| 字体字形覆盖 | 子集包含页面用字 | 新增文章引入新字后，缺字形**不报错**，浏览器静默回退到访客本机字体（字形混搭）；靠 CDP 的 `CSS.getPlatformFontsForNode` 才能看出 |

四者的共同点是**没有断言、没有测量、没有人工看一眼**。遇到底层工具/脚本行为异常时，先写一段最小复现确认假设，别直接怀疑调用方。

### 可加的自动检查（尚未实现）

前三条都是「改工具链时才会触发」的，但**字形覆盖**是内容更新的常规副作用，值得做成脚本：

1. 收集 `content/` + `app/` 的用字，与 `fonts-src/*.woff2` 的 cmap 求差集
2. 差集非空即报错，提示重跑 `subset-fonts.py` + `split-fonts.py`

这比「上线后靠 CDP 抽查」可靠，也能在 CI 里跑。
