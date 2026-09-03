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

- **新增文章**：在 `data/articles.ts` 追加条目（readTime 自动计算）→ 跑 `python subset-fonts.py`（先按文件头说明下载源字体）→ `npm run og` → `npm run build`。
- **修改 /now 页文案**：`app/now/page.tsx` 顶部 `nowBlocks` 常量。阅读区块内容为占位，请替换为真实在读书目。
