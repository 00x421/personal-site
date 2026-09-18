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

## 待办

### 迭代 5 · 缓存与传输（未开工）

| 项 | 现状 |
| --- | --- |
| 字体缓存 | 字体分片文件名没有内容哈希，所以只有 `max-age=3600`（对比 CSS 是 `max-age=31536000, immutable`）。`split-fonts.py` **同时产出 woff2 与 `@font-face` CSS**，它本来就知道内容——让文件名带短哈希即可升到 1 年。另注：产出 HTML 里**没有任何字体 preload**，而首屏关键片有 55KB，值得重新加上 |
| nginx | 配置极简，`location /` 全部 `proxy_pass` 到 `127.0.0.1:3000`，连 `/_next/static/` 与 `/fonts/` 都走 Node。可加直服 location + 长缓存，减轻 Node 负担 |
| HTML | 无显式 `Cache-Control`。配对写法：HTML 可重验，哈希资产长缓存 |

### 迭代 6 · 测试与结构（未开工，需先决策）

- **零测试**。`splitFrontmatter` / `calcReadTime` / `parseTags` / `escapeXml` 都是纯函数，用 Node 内置 `node --test`（项目已有 `--experimental-strip-types` 先例，**零新依赖**）覆盖成本极低
- `getRelated` / `getBacklinks` / `getAllTags` / `getAdjacent` / `getSeries` 在 `data/articles.ts` 里依赖 `import.meta.glob`，**无法在 Node 下测试**。抽出 `lib/article-queries.ts`（接受 `Article[]` 的纯函数）即可解锁
- `data/books.ts` 重复实现了一份 frontmatter 解析，存在行为漂移风险（本次引号修复已手动同步两处，属于信号）

### 已知但暂不处理

- **框架 JS 535KB**（React 186 + vinext 130 + 业务 112）：vinext beta 固有成本，等稳定版
- **`globals.css` 2368 行单文件**：注释与分区做得不错，可读性尚可，但无法 tree-shake。按关注点拆分（typography / rails / article / theme）优先级低
- **图片**：`personal-portrait-scribble.webp` 151KB 可再压到 ~80KB；`xwsx-air-pup-nav.png` 40KB 可转 webp
- **`.cta` 右上空场**：放大标题后从 55% 降到 43%，仍是一块不对称色场。可视为海报式的刻意留白；若要进一步收，需重新组织文案或加装饰，不建议无设计输入时动手
- **`text-spacing-trim`**：现代 CSS 有 `text-spacing-trim: trim-start` 可自动收全角标点前侧空白，但目前仅 Chrome 支持，暂不引入

---

## 改动后的验收基线

改完代码后按 HANDOFF 的「本地验证工作流」执行，并确认：

- [ ] `npm run lint` 零告警（`components/ui` 的 shadcn 模板既有告警除外）
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
