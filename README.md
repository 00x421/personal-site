# XWSX · 信我所行

> 把复杂的想法，做得清晰。

Linling Qi 的个人网站 — 产品、设计与代码交汇处的作品集。

## 技术栈

- **框架**：vinext（Next.js App Router on Vite 8，RSC）+ React 19 + TypeScript
- **样式**：Tailwind CSS 4 + shadcn/ui（Base UI）+ 自定义编辑杂志风设计系统
- **动效**：motion（SplitText / Reveal / TiltedCard / NumberTicker / Marquee）
- **主题**：明暗双主题（CSS 变量驱动，无闪烁初始化）
- **字体**：Noto Serif SC（自托管，按 unicode-range 分片加载）
- **部署目标**：Cloudflare Workers

## 开发

```bash
npm install        # 安装依赖（Node >= 22.13）
npm run dev        # 本地开发 http://localhost:3000
npm run build      # 生产构建
npm run start      # wrangler 本地预览构建产物
npm run lint       # oxlint
```

## 结构

```
app/                 # 路由页面（首页 / 文章列表 / 文章详情）
components/site/     # 页面区块组件（header/hero/projects/…/footer）
components/motion/   # 动效组件库
components/ui/       # shadcn/ui 基础组件
data/                # 文章与首页数据
lib/site-config.ts   # 站点配置（品牌/邮箱/社交链接）
```

## License

仅供个人作品展示使用。
