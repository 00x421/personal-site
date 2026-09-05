# XWSX 交接文档

> 面向接手人：现状、设计决策、踩坑记录、待办路线。日常操作（本地开发、写文章、部署）见 [README.md](./README.md)。

## 当前状态（2026-09-05）

- **站点功能完整**：首页、文章（含标签聚合/系列/反向链接）、项目案例、书架、/now、RSS、站内搜索、OG 图、JSON-LD，全部可用。
- **质量基线**：Lighthouse 无障碍 / 最佳实践 / SEO 全 100；性能（模拟 Fast 4G 口径）移动端 66 分、LCP 5.5s。
- **尚未部署上线**：一直在本地 `wrangler dev :8787` 预览。部署步骤 README 已写全，首次上线照做即可。
- **最新提交**：`a67c50c`（字体分片 + preload 清理 + hero 居中），已推送 `origin/main`（github.com/00x421/personal-site）。
- **CI**：GitHub Actions 每次 push/PR 跑 oxlint + build（node 22），当前绿。

## 架构地图

```
app/                    路由（RSC 服务端组件为主）
  layout.tsx            全局布局：字体 preload、主题脚本、JSON-LD
  page.tsx              首页（hero / 精选 / 文章 / 能力 / CTA 五区）
  articles|projects|books|now/   内容页
  rss.xml|search.json|robots.ts|sitemap.ts   机器接口
components/site/        客户端组件（'use client'，渐进增强）
  nav-buddy.tsx         导航栏空气小狗吉祥物（透明 PNG + 气泡）
  site-search.tsx       Cmd/Ctrl+K 命令面板（原生 <dialog>）
  theme-toggle / rail-scroller / reveal / reading-progress / ...
lib/                    markdown 解析、Prism 高亮、内容聚合（构建期+运行时共享）
data/                   文章/项目/书架的 TS 数据层（import.meta.glob 内联）
content/                Markdown 内容源（articles/projects/books + frontmatter）
scripts/generate-og.ts  satori 生成 OG 分享图（纯 Node，npm run og）
split-fonts.py          字体 unicode-range 分片（见下）
subset-fonts.py         全量 OTF → 站内用字整包子集（split 的上游）
fonts-src/              字体中间产物（gitignore，本地保留）
public/fonts/slices/    21 个分片 woff2（进 git，站点实际加载的字体）
```

**数据流**：`content/*.md` → 构建期 `import.meta.glob` 内联进 JS（Workers 运行时零文件系统依赖）→ `lib/site-content.ts` 聚合 → 各页面 RSC 渲染。搜索索引 `/search.json` 与 RSS 同源聚合。

## 关键设计决策（为什么这样做）

1. **vinext（Next.js on Vite）+ React 19 RSC**：要 App Router 心智 + Vite 构建速度 + Cloudflare Workers 部署。代价是框架 JS 较大（见性能一节），换来的是服务端渲染的内容页（SEO 友好）+ 最小客户端水合。
2. **Markdown 构建期内联**：Workers 无文件系统，内容必须在构建期进 bundle。副作用：改内容必须重新 `npm run build`（dev 模式有 HMR 不受影响）。
3. **字体 unicode-range 分片**（替代整包/全量子集）：中文 webfont 的体积问题靠「按需加载」解决——浏览器只下载页面实际用到的 unicode-range 片。首屏关键片 45KB preload 保证标题不闪。**注意**：`public/fonts/` 下的整包已删，`fonts-src/` 是 split 工具的输入（本地中间产物，不进 git）。
4. **`next.config.ts` 里 `reactMaxHeadersLength: 0`**：禁用 React 经 HTTP Link 头发的资源提示。三重效果：图片 preload 从 HTTP 头转 HTML 标签（首屏真用了，无警告）、vinext 字体 preload 的 Link 头被禁（app router 字体 preload 只走 HTTP 头渠道）、console 零警告。**别删这个配置**，删了 preload 警告会回来。
5. **吉祥物/主题切换等交互全部渐进增强**：服务端渲染基础态，客户端组件只做增强，JS 失败页面仍完整可读。

## 性能现状与瓶颈

模拟 Fast 4G（Lighthouse 默认移动口径）：

| 指标 | 值 | 说明 |
|---|---|---|
| Performance | 66 | 优化前 64 |
| LCP | 5.5s | 优化前 6.9s |
| FCP | 4.6s | 优化前 4.9s |
| 总传输 | ~1.2MB | 字体 384KB（按需 13 片）+ JS 535KB + 图片 |

- **剩余瓶颈是 535KB 框架 JS**（React 186KB + vinext 130KB + 业务 112KB + runtime），vinext beta 固有成本，动不了。真实部署走 Cloudflare CDN + HTTP/3 + 缓存头，体验会明显好于模拟值。
- **可选优化**（收益递减，按需做）：
  - `public/personal-portrait-scribble.webp` 151KB → Pillow 重压缩（768x1152 RGB，可到 ~80KB）
  - `public/xwsx-air-pup-nav.png` 40KB → 转 webp（RGBA）
  - OG 图 257KB 仅社交分享时加载，不影响首屏，不用动

## 已知坑（血泪经验，务必读）

### Windows / PowerShell
- **含中文的文件编辑一律用 Python**（`io.open` + `encoding="utf-8"` + `newline="\n"`）。PowerShell `Get-Content`（无 -Encoding）按 GBK 解码 UTF-8，`Set-Content` 写回 = 乱码固化；`-NoNewline` + 数组拼接 = 丢换行。曾因此损坏 globals.css，靠 git restore 恢复。
- **PowerShell `>` 重定向输出是 UTF-16 LE**：Python 读它要 `encoding="utf-16"`；**二进制文件（字体/图片）绝不能用 PowerShell `>` 从 git 恢复**（会膨胀 2 倍损坏），用 `cmd /c "git cat-file blob <sha> > file"`。
- **python stdin 管道传中文会变 `?`**：脚本里避免中文路径字面量，用相对路径（工作目录已是项目根）或写临时 .py 文件再跑。
- `git push` 的 stderr 报 exit code 1 是 PowerShell 误报，看到 `main -> main` 就是成功。

### Lighthouse / 测试口径
- **同口径才可比**：`--throttling-method=provided`（真实环境）与默认模拟口径分数差 30 分，别混着比。
- **headless Chrome 光栅化怪癖**：observedLoad 393ms 但 observedFCP 2377ms、observedLCP undefined——provided 口径在 headless 下不可信，以模拟口径 + 真实浏览器体验为准。
- 移动视口 reload + 缓存命中场景，Chrome 会误报字体 preload 警告；干净加载（新开无痕）才是真信号。
- Lighthouse JSON 700KB，PowerShell `ConvertFrom-Json` 会爆，用 node 脚本解析。

### vinext / 框架
- **vinext 字体 preload 只走 HTTP Link 头**（dev-server.js 源码确认），`reactMaxHeadersLength: 0` 会把它一起禁掉——所以 layout.tsx 里有手动 `<link rel="preload">`（HTML 渠道）兜底，两者配套。
- 构建产物预览必须用 `npm run start`（wrangler dev 跑 `dist/server/wrangler.json`），改代码后要重新 build。
- wrangler dev 偶发缓存旧资产：停进程 → 删 `.wrangler/state/v3/cache` → 重启。

## 本地验证工作流（改完代码后）

```bash
npm run lint        # oxlint
npm run build       # 必须过，CI 同款
npm run start       # wrangler dev :8787 预览构建产物
```

浏览器验证清单：console 零警告、明暗两主题、移动视口（DevTools 390px）布局、小狗吉祥物气泡、搜索面板。Lighthouse 复测用固定命令（见上文口径提醒）。

## 待办与建议路线

1. **首次部署上线**（README「部署到 Cloudflare Workers」一节，需要 wrangler login + 账户 ID + `NEXT_PUBLIC_SITE_URL`）。
2. 上线后把 `NEXT_PUBLIC_SITE_URL` 设为正式域名重新 build（canonical/RSS/OG/JSON-LD 都依赖它）。
3. 可选：图片压缩（见性能一节）。
4. 可选：vinext 升级观察（beta.9 → 稳定版时框架 JS 可能下降）。
5. 内容维护节奏：新文章 → `npm run og` → 字体片按需更新（README「写一篇文章」第 4 步）。

## 近期变更里程碑（git log 摘要）

- `a67c50c` 字体 unicode-range 分片 + preload 清理 + hero 居中（性能批次收尾）
- `1fea2c7` 04 区孤立 `</>` 图标改说明文字
- `f9c758c` 统一内容区间距节奏
- `f5ca4bd` hero 标题两行保底 + 03 区标准大标题
- `5fb958f` hero 标签带跑马灯 + 章节序号独立
- `2536646` hero 关键词带改 RPA / AI Agent / 自动化方向
- `b238608` 触屏导航触控目标 44px
- `08a6a3f` 站内搜索评审修复（键盘下标/重试/Esc）
- 更早：RSS、/now、OG 图、站内搜索、Markdown 管线、字体子集化、Lighthouse 无障碍修复
