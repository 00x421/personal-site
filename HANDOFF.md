# XWSX 交接文档

> 面向接手人：现状、设计决策、踩坑记录、待办路线。日常操作（本地开发、写文章、部署）见 [README.md](./README.md)。

## 当前状态（2026-09-05）

- **站点功能完整**：首页、文章（含标签聚合/系列/反向链接）、项目案例、书架、/now、RSS、站内搜索、OG 图、JSON-LD，全部可用。
- **质量基线**：Lighthouse 无障碍 / 最佳实践 / SEO 全 100；性能（模拟 Fast 4G 口径）移动端 66 分、LCP 5.5s。
- **已上线（2026-09-13）**：https://xwsx.top ，自托管 Node（vinext standalone 路径），未走 Cloudflare。部署架构见下节。
- **最新提交**：`ee206b0`（CI 兜底修复），已推送 `origin/main`（github.com/00x421/personal-site）。
- **CI**：GitHub Actions 每次 push/PR 跑 oxlint + build（node 24）。曾连续 5 次失败：rolldown 1.0.1 自身声明矛盾（deps 钉死 @emnapi/* 1.10.0 + 传递 peer ^1.7.1），Linux npm ci 严格校验误报 Missing 1.11.3，Windows 不装 wasm32 子树无法复现。`ee206b0` 改 `npm ci --legacy-peer-deps` + `npm install` 兜底后恢复绿；根治需升级 rolldown/vite。

## 部署架构（2026-09-13 起）

- **服务器**：腾讯云 Ubuntu 24.04（43.139.214.236），SSH 用户 `xwsx`（密钥登录，免密 sudo）。
- **构建**：`NEXT_PUBLIC_SITE_URL=https://xwsx.top npm run build` → postbuild 钩子（`scripts/fix-standalone.mjs`）自动补 react 系依赖 → `tar -czf` 打包 `dist/standalone`（约 9MB）。
- **运行**：上传解包到 `/home/xwsx/xwsx-site/standalone`，systemd 服务 `xwsx.service` 以 xwsx 用户跑 `node server.js`（绑定 127.0.0.1:3000，`Restart=on-failure`，开机自启）。
- **入口**：nginx `/etc/nginx/sites-available/xwsx.top` 反代 127.0.0.1:3000，80 强跳 443，改动前有 `.bak.20260913` 备份。
- **证书**：Let's Encrypt（`certbot --nginx` 签发，`certbot.timer` 自动续期已验证 dry-run 通过；原 TrustAsia 证书 2026-08-05 过期，已替换）。
- **重新部署**：本地执行 `npm run deploy`（= `scripts/deploy.mjs`：清 dist → 构建 → postbuild 补依赖 → 打包 scp → 远端备份旧产物、解包、`systemctl restart` → 健康检查失败自动回滚）。服务器上的手工等价命令：
  ```bash
  sudo systemctl stop xwsx && rm -rf ~/xwsx-site/standalone && tar -xzf ~/xwsx-standalone.tar.gz -C ~/xwsx-site && sudo systemctl start xwsx
  ```
- **回滚**：`deploy.mjs` 每次部署前把旧产物留在 `~/xwsx-site/standalone.bak`（保留上一版），出问题执行：
  `sudo systemctl stop xwsx && rm -rf ~/xwsx-site/standalone && mv ~/xwsx-site/standalone.bak ~/xwsx-site/standalone && sudo systemctl start xwsx`
- **SSH**：`ssh -i ~/.ssh/id_ed25519 xwsx@43.139.214.236`（免密 sudo 已验证可用；若连不上多半是服务器侧 IP 封禁）。

## 架构地图

```
app/                    路由（RSC 服务端组件为主）
  layout.tsx            全局布局：字体 preload、主题脚本、JSON-LD
  page.tsx              首页（hero / 精选 / 文章 / 关于 / 怎么做事 / CTA）
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

**数据流**：`content/*.md` → 构建期 `import.meta.glob` 内联进 JS（运行时零文件系统依赖）→ `lib/*` 聚合 → 各页面 RSC 渲染。搜索索引 `/search.json` 与 RSS 同源聚合。`draft: true` 的文章与项目在这一层就被过滤，因此页面、RSS、搜索索引、sitemap、标签云的表现自动一致。

## 关键设计决策（为什么这样做）

1. **vinext（Next.js on Vite）+ React 19 RSC**：要 App Router 心智 + Vite 构建速度 + 服务端渲染的内容页（SEO 友好）+ 最小客户端水合。代价是框架 JS 较大（见性能一节）。
2. **Markdown 构建期内联**：内容必须在构建期进 bundle，运行时不需要文件系统。副作用：改内容必须重新 `npm run build`（dev 模式有 HMR 不受影响）。
3. **字体 unicode-range 分片**：中文 webfont 的体积问题靠「按需加载」解决——浏览器只下载页面实际用到的 unicode-range 片。**注意**：`public/fonts/` 下的整包已删，`fonts-src/` 是 split 工具的输入（本地中间产物，不进 git）。
   > ✅ **2026-09-17 已修复。** 真正的根因是 `split-fonts.py` 里一处类型错误：`getBestCmap()` 返回的是**整数码位**，而 `CRITICAL` 是**字符串集合**，`all_chars - CRITICAL` 是「int 集合减 str 集合」的恒空操作——减法写了，一个元素也没减掉。于是每个普通片都重复包含关键片的字符，而 CSS 对重叠的 `unicode-range` 取**最后声明**的那条，`s0` 被全面遮蔽、从不被浏览器取用（清缓存加载首页实测：13 个切片 / 383KB，`s0` 未下载）。
   > 修复：先把 `CRITICAL` 转成码位再相减，并加了一段自检——任何两片码位相交就 `SystemExit`。重新生成后每个字重 9 片、三份合计 365KB（此前因重复包含关键片字符而更大）。子集也一并扩充了（字形 575 → 1516，覆盖新文章用字）。复盘见 `/articles/chinese-font-slicing-failed`。
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

- **剩余瓶颈是 535KB 框架 JS**（React 186KB + vinext 130KB + 业务 112KB + runtime），vinext beta 固有成本，动不了。真实部署下静态资源有长缓存（CSS 一年 immutable），体验优于模拟值。
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
- **standalone 包缺 react 系依赖**（beta.9）：打包器把 react/react-dom 捆进 server bundle，但原样拷贝的 vinext/dist 运行时仍以 peer 方式 import react，启动即 `ERR_MODULE_NOT_FOUND: Cannot find package 'react'`。`scripts/fix-standalone.mjs`（npm postbuild 钩子）自动补齐 react/react-dom/react-server-dom-webpack/scheduler/marked/prismjs。
- **Windows 构建怪癖（2026-09-17 查明根因）**：本机路径含非 ASCII（`…\牛马工作区\site`）时，Node 的 `fs.rmSync(dir, {recursive:true, force:true})` 会**整体静默失效** —— 报 `errno 0`「操作成功完成」却一个文件都不删（`force:true` 又吞掉异常）。后果：旧 `dist/standalone/dist/client/.assetsignore` 残留，vinext 的 standalone 产出阶段用 `cpSync` 覆盖旧文件时 unlink 报错，构建中断；`maxRetries` 无效，加 `\\?\` 前缀是 Node 内部行为（手动 `readdir` + `unlink`/`rmdir` 走另一分支，实测 4000+ 文件零失败）。**已由 `scripts/clean-dist.mjs` 取代**（`npm run build` 第一步就调用它），别再改回 `rmSync`。
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

迭代计划与详细待办见 [ROADMAP.md](./ROADMAP.md)。要点：

1. **字体分片修复**：当前首屏 383KB 且关键片从未生效（见「关键设计决策」第 3 条）。修法有二：让 `split-fonts.py` 直接改写样式表（而不是人工贴回），并在生成时校验各片 `unicode-range` 交集为空。
2. **缓存与传输**：字体文件名加内容哈希 → 可升到长缓存；nginx 直服 `/_next/static/` 与 `/fonts/` 减轻 Node 负担；HTML 补显式 `Cache-Control`。
3. **补测试**：内容解析与聚合都是纯函数，抽出后可用 `node --test` 覆盖（零新依赖）。
4. 可选：图片压缩（见性能一节）；vinext 升级观察（beta → 稳定版时框架 JS 可能下降）。
5. 内容维护节奏：新文章 → `npm run og` → 用字有变化时跑字体分片（README「写一篇文章」第 4 步）。
6. 新内容尽量基于真实经历。此前有一批占位内容已撤下（见「内容状态」），**编造的细节比空着更伤可信度**。

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
