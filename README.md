# XWSX — 信我所行


> 面向接手人：[HANDOFF.md](./HANDOFF.md) 记录现状、设计决策与踩坑记录；迭代计划与待办见 [ROADMAP.md](./ROADMAP.md)。
产品、设计与代码交汇处的个人作品集站点。基于 [vinext](https://github.com/cloudflare/vinext)（Next.js on Vite）+ React 19 RSC + Tailwind 4，线上以 vinext standalone 产物自托管在腾讯云（见「部署」一节）。

## 本地开发

```bash
npm install
npm run dev        # 开发服务器（HMR）
npm run build      # 生产构建 -> dist/
npm run start      # 本地运行构建产物（wrangler dev，端口 8787）
npm run lint       # oxlint
npm test           # node --test（内容解析 + 集合查询，零新依赖）
npm run og         # 为全部文章重新生成 1200x630 OG 分享图
npm run fonts      # 重建字体分片（新增文章用字后跑；会直接改写 globals.css）
npm run images     # 吉祥物图 PNG → WebP（换图后跑）
npm run portrait   # 肖像图 → 5 档响应式 WebP（换图后跑，母版放 images-src/）
npm run deploy     # 构建并部署到线上服务器（见「部署」一节）
```

预览生产构建的完整命令：

```bash
npm run build
npm run start
```

## 技术要点

- **App Router 服务端组件**：首页在服务端渲染，可交互部件（主题切换、滚动轨道、小狗吉祥物）以客户端组件（`'use client'`）注入。
- **Markdown 内容管线**：`content/articles/*.md`、`content/projects/*.md` 与 `content/books/*.md` + frontmatter；站点侧由 Vite `import.meta.glob` 构建期内联（运行时零文件系统依赖），`scripts/generate-og.ts` 在纯 Node 下 fs 直读，两侧共享 `lib/markdown.ts` 解析（marked 渲染 + 阅读时长估算）。项目案例页由 Markdown 正文驱动：`##` 分区 CSS 计数器自动编号，frontmatter `deliverables` 尾部自动成区。代码块由 Prism 在服务端高亮（token 色走 CSS 变量明暗双主题），复制按钮由客户端组件对已有 `<pre>` 渐进增强。
- **三层内容结构**：解析（`lib/content-parse.ts`，零依赖）→ 查询（`lib/article-queries.ts`，纯函数收 `Article[]`）→ 加载（`data/*.ts`，只做 `import.meta.glob` 与转发）。前两层能在纯 Node 下跑，所以有测试；第三层只有 Vite 能跑，靠前两层间接覆盖。**新查询逻辑加到 `article-queries.ts` 并带测试。**
- **草稿状态**：文章与项目都支持 frontmatter `draft: true`，为真时该条从页面、RSS、搜索索引、sitemap、标签云**全部消失**（因为共用同一份聚合结果）。
- **标签聚合**：文章标签自动聚合成 `/articles` 标签云与 `/articles/tag/<标签>` 聚合页（中文标签即路径，构建时统一 URL 编解码）。
- **数字花园微网络**：frontmatter `series` 生成系列眉标与底部阅读顺序导航；正文站内链接自动汇成对方页面的「链接到本文」反向链接（构建期 HTML 扫描，零运行时开销）。
- **字体分片**：`split-fonts.py` 把 Noto Serif SC 拆成 unicode-range 分片（29 片），输出到 `public/fonts/slices/`，文件名带内容哈希。**每个字重有一个关键片**（`s0`），覆盖首页全部衬线文字，由 `layout.tsx` 预加载并并行下载——实测首屏只需 3 片 / 97 KB。脚本会直接改写 `app/globals.css` 的 `@font-face` 块与 `lib/font-slices.generated.ts`，采集口径与自检写在脚本头部。`fonts-src/` 是它的输入（本地中间产物，不进 git），`subset-fonts.py` 负责从完整 OTF 生成整包。
- **静态资源与缓存**：带内容哈希的资产（`/_next/static/`、`/fonts/slices/`）由 nginx 直服并设一年 immutable；图片类一周（文件名无哈希）；页面 `no-cache`（每次重验）。静态资源不经 Node，访问日志也关了。详见 HANDOFF 的部署架构一节。
- **RSS**：`app/rss.xml/route.ts` 输出 RSS 2.0，已加入 `<link rel="alternate">` 自动发现。
- **站内搜索**：`app/search.json/route.ts` 聚合文章 / 项目 / 书架输出全文索引（缓存 1 小时），`components/site/site-search.tsx` 原生 `<dialog>` 命令面板（右下角入口 + Cmd/Ctrl+K），首次打开才懒加载索引，多关键词 AND 加权评分，标题 / 摘要命中片段实时高亮。
- **动态 OG 图**：`npm run og` 用 satori + @resvg/resvg-js 生成 `public/og/articles/{slug}.png` 与 `public/og/projects/{slug}.png`，文章 / 案例页 metadata 自动引用。
- **结构化数据**：布局注入 Person/WebSite JSON-LD，文章页注入 Article JSON-LD。
- **无障碍**：Lighthouse 无障碍 100 / 最佳实践 100 / SEO 100。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 站点正式 URL（构建时内联，用于 canonical / RSS / OG / JSON-LD）。未设置时回退 `http://localhost:3000`。 |
| `NOTO_SRC_DIR` | 可选。OG 脚本读取源字体的目录，默认 `%TEMP%/noto-src`。 |

## 部署（自托管 Node）

线上地址 **https://xwsx.top**：腾讯云 Ubuntu 自托管，跑 vinext 的 standalone 产物（systemd + nginx 反代 + Let's Encrypt），未走 Cloudflare。完整架构见 [HANDOFF.md](./HANDOFF.md)「部署架构」一节。

### 一键部署

```bash
npm run deploy
```

`scripts/deploy.mjs` 依次完成：清理 `dist` → 构建（内联 `NEXT_PUBLIC_SITE_URL`）→ postbuild 补 react 系运行时依赖 → 打包 `dist/standalone` → `scp` 上传 → 远端备份旧产物、解包、重启 systemd → 健康检查（失败自动回滚）。部署期间线上会有几秒不可用。

默认值可用环境变量覆盖：`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_KEY`、`NEXT_PUBLIC_SITE_URL`、`DEPLOY_REMOTE_DIR`、`DEPLOY_SERVICE`。

- **回滚**：部署前上一版会留在服务器 `~/xwsx-site/standalone.bak`，执行
  ```bash
  sudo systemctl stop xwsx && rm -rf ~/xwsx-site/standalone && mv ~/xwsx-site/standalone.bak ~/xwsx-site/standalone && sudo systemctl start xwsx
  ```
- **前提**：本地 `~/.ssh/id_ed25519` 已加入服务器 `xwsx` 用户的 `authorized_keys`（免密 sudo 已配置）。
- **手动等价命令**：`tar -czf` 打包 `dist/standalone` → `scp` 上传 → 服务器解包到 `~/xwsx-site` → `sudo systemctl restart xwsx`。

### 备选：Cloudflare Workers（当前未使用）

如需改回边缘部署：

1. `npx wrangler login`（CI 用 `CLOUDFLARE_API_TOKEN`，Cloudflare 后台创建 **Edit Cloudflare Workers** 模板 token）。
2. `npx wrangler whoami` 获取账户 ID，或从 `dash.cloudflare.com/<account-id>` 得到。
3. 设置 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_API_TOKEN`、`NEXT_PUBLIC_SITE_URL` 后执行
   ```bash
   npx @vinext/cloudflare deploy --name xwsx
   ```
   `--preview` 可部署到预览环境；绑定自有域名在 Cloudflare 控制台的 Workers > 域名 中添加。

> 仓库里的 `.openai/hosting.json` 是早期 OpenAI Sites 托管的遗留配置（`legacy-origin` 远程对应），当前不使用，可忽略。

## 内容维护

### 写一篇文章

文章是 `content/articles/` 下的 Markdown 文件，**文件名即 URL slug**（如 `how-this-site-is-built.md` → `/articles/how-this-site-is-built`）。写作流程：

1. 新建 `content/articles/<slug>.md`，开头是 frontmatter：

   ```markdown
   ---
   title: 文章标题
   description: 一句话摘要（列表页、SEO、OG 图、RSS 都用它）。
   published: 2026-09-03
   tags: [产品思考, 工程实践]
   series: 工程手记      # 可选，同系列文章自动生成顶部眉标与底部阅读顺序导航
   draft: true          # 可选，true 时不出现在线上任何地方
   ---

   ## 第一个小标题

   正文用 Markdown 写：支持**加粗**、*斜体*、`行内代码`、[链接](https://example.com)、
   列表、引用、代码块和图片。标题从 `##` 开始（`#` 留给页面的文章大标题）。
   ```

2. 发布：删掉 `draft: true`（或一开始就不写）。
3. 生成 OG 分享图：`npm run og`（需按 `subset-fonts.py` 文件头说明先备好源字体）。
4. 站点用字有变化时（新增长文、新栏目）：`npm run fonts`。它会重出字体分片、直接改写 `app/globals.css` 的 `@font-face` 块与 `lib/font-slices.generated.ts`（preload 清单），并自检分片不重叠。若脚本提示「某标题用字不在 w500 关键片内」，按脚本头部说明重新采集 `CRITICAL_BY_WEIGHT` 再跑一次，然后 `npm run build`。上游整包子集由 `subset-fonts.py` 生成，输入放在 `fonts-src/`。

阅读时长按正文长度自动估算；上一篇 / 下一篇导航和「相关阅读」（按标签重叠推荐，无重叠时回退最新文章）全部自动生成。正文中链接到其他文章（`/articles/<slug>`）时，对方页面底部会自动出现「链接到本文」反向链接。

### 写一个项目

项目是 `content/projects/` 下的 Markdown 文件，**文件名即 URL slug**。**只写 frontmatter = 仅首页卡片；补上正文 = 自动生成 `/projects/<slug>` 案例页**（HTML 注释不算正文）：

```markdown
---
title: 项目名
type: 产品设计          # 首页筛选维度，新类型会自动出现在筛选栏
year: '2026'
summary: 一句话卡片摘要。
tags: [标签A, 标签B]
tone: violet           # 卡片配色：ink / violet / lime
mark: '01'             # 卡片装饰符号
order: 1               # 首页排序，小者在前
status: 查看案例        # 可选，默认按有无正文自动取「查看案例/案例整理中」
eyebrow: CASE STUDY    # 案例页眉标
meta: [开发实践, 已授权场景]   # 案例页 hero 徽章组，缺省为 [type]
deliverables:          # 案例页尾部自动渲染的交付物徽章（紧跟正文分区自动编号）
  - 交付物一
  - 交付物二
draft: true            # 可选，true 时首页卡片与案例页都不出现
---

## 背景

正文即案例页：`## 分区标题` 自动编号成「01 / 背景」眉题，
`### 大标题` 渲染为衬线宣言，`#### 小节` 用于方法步骤，
列表项自动带紫色 ✓ 标记。
```

首页卡片、筛选栏（从项目 `type` 动态去重）、案例页、sitemap 全部由这一份文件驱动。只有一种 `type` 时筛选栏会自动隐藏（此时「全部」与它结果相同）。

> **内容真实性**：这个站点展示的是真实经历与真实数据。写没做过的事、或把没测过的数字写进去，比留空更伤可信度——访客里会有工程师，他们会去 DevTools 里核对。

### 记录一本书

书是 `content/books/` 下的 Markdown 文件，**文件名即 slug**，只认 frontmatter（正文暂不渲染）：

```markdown
---
title: 认知觉醒
author: 周岭
status: 在读            # 在读 / 读完 / 想读，书架页按此分组
started: 2026-08        # 开始阅读年月，组内按它倒序
takeaway: 留在身上的一句话，会以引用样式展示。
---
```

`/books` 书架页、`/now` 阅读区块（同目录数据）、页脚「书架」入口自动生效。

- **修改 /now 页文案**：`app/now/page.tsx` 顶部 `nowBlocks` 常量，阅读区块保留为真实在读书目。
