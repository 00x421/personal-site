# XWSX — 信我所行

产品、设计与代码交汇处的个人作品集站点。基于 [vinext](https://github.com/cloudflare/vinext)（Next.js on Vite）+ React 19 RSC + Tailwind 4，部署目标是 Cloudflare Workers。

## 本地开发

```bash
npm install
npm run dev        # 开发服务器（HMR）
npm run build      # 生产构建 -> dist/
npm run start      # 本地运行构建产物（wrangler dev，端口 8787）
npm run lint       # oxlint
npm run og         # 为全部文章重新生成 1200x630 OG 分享图
```

预览生产构建的完整命令：

```bash
npm run build
npm run start
```

## 技术要点

- **App Router 服务端组件**：首页在服务端渲染，可交互部件（主题切换、滚动轨道、小狗吉祥物）以客户端组件（`'use client'`）注入。
- **Markdown 内容管线**：`content/articles/*.md` + frontmatter；站点侧由 Vite `import.meta.glob` 构建期内联（Workers 运行时零文件系统依赖），`scripts/generate-og.ts` 在纯 Node 下 fs 直读，两侧共享 `lib/markdown.ts` 解析（marked 渲染 + 阅读时长估算）。
- **字体子集化**：`subset-fonts.py` 将 Noto Serif SC 全量 OTF 按站内实际用字子集为 woff2（`public/fonts/`），控制中文字体体积。
- **RSS**：`app/rss.xml/route.ts` 输出 RSS 2.0，已加入 `<link rel="alternate">` 自动发现。
- **动态 OG 图**：`npm run og` 用 satori + @resvg/resvg-js 按文章数据生成 `public/og/articles/{slug}.png`，文章页 metadata 自动引用。
- **结构化数据**：布局注入 Person/WebSite JSON-LD，文章页注入 Article JSON-LD。
- **无障碍**：Lighthouse 无障碍 100 / 最佳实践 100 / SEO 100。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 站点正式 URL（构建时内联，用于 canonical / RSS / OG / JSON-LD）。未设置时回退 `http://localhost:3000`。 |
| `NOTO_SRC_DIR` | 可选。OG 脚本读取源字体的目录，默认 `%TEMP%/noto-src`。 |

## 部署到 Cloudflare Workers

首次部署前需要：

1. 安装 [wrangler](https://developers.cloudflare.com/workers/wrangler/) 并登录：
   ```bash
   npx wrangler login
   ```
   CI 场景改用 `CLOUDFLARE_API_TOKEN`（Cloudflare 后台创建 **Edit Cloudflare Workers** 模板 token）。
2. 获取账户 ID：`npx wrangler whoami`，或从 `dash.cloudflare.com/<account-id>` 得到。
3. 执行部署（命令前设置环境变量，避免把凭据写进仓库）：
   ```bash
   set CLOUDFLARE_ACCOUNT_ID=<account-id>
   set CLOUDFLARE_API_TOKEN=<token>   # 或用 wrangler login 登录后省略
   set NEXT_PUBLIC_SITE_URL=https://你的域名
   npx @vinext/cloudflare deploy --name xwsx
   ```
   `--name` 指定线上 Worker 名称；`--preview` 可部署到预览环境。如需绑定自有域名，部署后在 Cloudflare 控制台的 Workers > 域名 中添加。

> 仓库里的 `.openai/hosting.json` 是早期 OpenAI Sites 托管的遗留配置（`legacy-origin` 远程对应），当前不使用，可忽略。

## 内容维护

### 写一篇文章

文章是 `content/articles/` 下的 Markdown 文件，**文件名即 URL slug**（如 `build-small-systems.md` → `/articles/build-small-systems`）。写作流程：

1. 新建 `content/articles/<slug>.md`，开头是 frontmatter：

   ```markdown
   ---
   title: 文章标题
   description: 一句话摘要（列表页、SEO、OG 图、RSS 都用它）。
   published: 2026-09-03
   tags: [产品思考, 工程实践]
   draft: true          # 可选，true 时不出现在线上任何地方
   ---

   ## 第一个小标题

   正文用 Markdown 写：支持**加粗**、*斜体*、`行内代码`、[链接](https://example.com)、
   列表、引用、代码块和图片。标题从 `##` 开始（`#` 留给页面的文章大标题）。
   ```

2. 发布：删掉 `draft: true`（或一开始就不写）。
3. 生成 OG 分享图：`npm run og`（需按 `subset-fonts.py` 文件头说明先备好源字体）。
4. 中文新字较多时跑 `python subset-fonts.py` 扩充字体子集，然后 `npm run build`。

阅读时长按正文长度自动估算；上一篇 / 下一篇导航和「相关阅读」（按标签重叠推荐，无重叠时回退最新文章）全部自动生成。

- **修改 /now 页文案**：`app/now/page.tsx` 顶部 `nowBlocks` 常量，阅读区块保留为真实在读书目。
