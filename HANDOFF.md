# XWSX 交接文档

> 面向接手人：现状、设计决策、踩坑记录、待办路线。日常操作（本地开发、写文章、部署）见 [README.md](./README.md)。

## 当前状态（2026-09-18）

- **站点功能完整**：首页、文章（含标签聚合/系列/反向链接）、项目案例、书架、/now、RSS、站内搜索、OG 图、JSON-LD，全部可用。
- **质量基线**（2026-09-20 Lighthouse 13.4.1 实测）：无障碍 / 最佳实践 / SEO **全 100**；性能移动端 **93–97**（连跑 3 次有 ±4 波动）、桌面端（1350×940）**77**；TBT 0 ms、CLS 0。移动端 Performance 曾为 66，明细见 [ROADMAP.md](./ROADMAP.md)。
- **首屏传输**（Lighthouse 移动端口径）：**~473 KB**（脚本 175 + 图片 129 + 字体 96 + CSS 18 + 文档 12）。图片已从 159 KB 降到 129 KB（移动）/ 45 KB（桌面），靠肖像图改响应式。
- **已上线（2026-09-13）**：https://xwsx.top ，自托管 Node（vinext standalone 路径），未走 Cloudflare。部署架构见下节。
- **测试**：`npm test` **140 个用例**（`node --test`，零新依赖）覆盖三层纯函数层：内容解析、集合查询、机器接口序列化（RSS / search.json / sitemap）、以及 globals.css 结构断言与字形覆盖。为此把查询逻辑从 `data/articles.ts` 抽到了 `lib/article-queries.ts`、把序列化从三个 route 抽到了 `lib/feed-builders.ts`，见下「三层结构」。
- **CI**：GitHub Actions 每次 push/PR 跑 oxlint + build（node 24）。曾连续 5 次失败：rolldown 1.0.1 自身声明矛盾（deps 钉死 @emnapi/* 1.10.0 + 传递 peer ^1.7.1），Linux npm ci 严格校验误报 Missing 1.11.3，Windows 不装 wasm32 子树无法复现。改 `npm ci --legacy-peer-deps` + `npm install` 兜底后恢复绿；根治需升级 rolldown/vite。

## 部署架构（2026-09-13 起，静态资源直服 2026-09-18 加入）

- **服务器**：腾讯云 Ubuntu 24.04（43.139.214.236），SSH 用户 `xwsx`（密钥登录，免密 sudo）。
- **构建**：`NEXT_PUBLIC_SITE_URL=https://xwsx.top npm run build` → postbuild 钩子（`scripts/fix-standalone.mjs`）自动补 react 系依赖 → `tar -czf` 打包 `dist/standalone`（约 9MB）。
- **运行**：上传解包到 `/home/xwsx/xwsx-site/standalone`，systemd 服务 `xwsx.service` 以 xwsx 用户跑 `node server.js`（绑定 127.0.0.1:3000，`Restart=on-failure`，开机自启）。
- **入口**：nginx `/etc/nginx/sites-available/xwsx.top`（备份 `.bak.20260918`），80 强跳 443。
  - `/_next/static/` 与 `/fonts/slices/` 用 `alias` **直服**（不过 Node），一年 immutable。
  - 图片类（`png/jpe?g/webp/gif/svg/ico/txt`）直服 + 一周缓存，未命中回落 `@app`。
  - 其余走 `include /etc/nginx/snippets/xwsx-proxy.conf` 反代到 3000。
  - HTML 的 `no-cache` 由 `map $upstream_http_cache_control` 决定：上游没给缓存头才补，`/rss.xml` 与 `/search.json` 自带的策略原样放行。
  - ⚠️ **`/home/xwsx` 必须是 711**（可穿越、不可列目录）——nginx 以 www-data 运行，750 会让所有直服 404。重建用户或调整家目录权限时留意。
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
  layout.tsx            全局布局：字体 preload、主题脚本、JSON-LD、**全站备案条**
  page.tsx              首页（hero / 精选 / 文章 / 关于 / 能做 / CTA / 页脚）
  articles|projects|books|now/   内容页
  rss.xml|search.json|robots.ts|sitemap.ts   机器接口
components/site/        客户端组件（'use client'，渐进增强）
  nav-buddy.tsx         导航栏空气小狗吉祥物（透明 WebP + 气泡，四态轮播）
  project-explorer.tsx  项目筛选与横滚（**卡片数据由服务端传入**，别 import data/*）
  site-search.tsx       Cmd/Ctrl+K 命令面板（原生 <dialog>）
  theme-toggle / rail-scroller / reveal / reading-progress / ...
lib/                    解析与聚合（构建期+运行时共享）
  content-parse.ts      frontmatter 解析 / 阅读时长 / XML 转义（**零依赖，可直接测**）
  article-queries.ts    集合查询纯函数（收 Article[]；运行时零 import，可直接测）
  feed-builders.ts      RSS / search.json / sitemap 序列化（纯函数，**route 里不再拼字符串**）
  css-integrity.ts      globals.css 结构断言（字体分片区 / :root 完整性 / 主题成对 / 裸色值）
  glyph-coverage.ts     字形覆盖断言（内容用字 ⊆ 分片 unicode-range 并集）
  markdown.ts           marked 配置 + buildArticle / buildProject
  highlight.ts          Prism 高亮
  font-slices.generated.ts  关键片清单（split-fonts.py 生成，勿手改）
data/                   文章/项目/书架的 TS 数据层（import.meta.glob 内联，并转发到 article-queries）
content/                Markdown 内容源（articles/projects/books + frontmatter）
tests/                  node --test 套件（npm test）
scripts/generate-og.ts  satori 生成 OG 分享图（纯 Node，npm run og）
scripts/deploy.mjs      一键部署（npm run deploy，含健康检查与回滚）
scripts/clean-dist.mjs  跨平台清 dist（替代会静默失效的 fs.rmSync）
scripts/check-css-integrity.ts   样式表结构门禁（npm run check:css，build 里跑）
scripts/check-glyph-coverage.ts  字形覆盖门禁（npm run check:glyphs，build 里跑）
scripts/optimize-pup-images.py  吉祥物 PNG → WebP（npm run images）
scripts/optimize-portrait.py   肖像图 → 5 档响应式 WebP（npm run portrait）
images-src/             图像母版（gitignore；恢复命令见 optimize-portrait.py 头部）
split-fonts.py          字体 unicode-range 分片（见下）
subset-fonts.py         全量 OTF → 站内用字整包子集（split 的上游）
fonts-src/              字体中间产物（gitignore，本地保留）
public/fonts/slices/    31 个分片 woff2（进 git，文件名带内容哈希；数量由字形覆盖断言盯住）
public/beian-gongan.png 公安部备案徽标（官方下载件，原样使用、勿压缩）
public/personal-portrait-scribble-{320,480,640,800,1024}.webp  肖像图响应式候选集
```

**客户端包的边界（重要）**：`'use client'` 组件**不能** import `@/data/*`。那些模块用 eager 的 `import.meta.glob('?raw')` 把全部 Markdown 原文内联，客户端一旦引用就会连带打进 marked、prismjs 与所有案例全文（实测 `project-explorer` 因此膨胀到 84 KB）。数据在服务端取好，以 props 传入。

**三层结构（待测代码的分层依据）**：

| 层 | 文件 | 依赖 | 可测 |
| --- | --- | --- | --- |
| 解析 | `lib/content-parse.ts` | 无 | ✅ 直接 `node --test` |
| 查询 | `lib/article-queries.ts` | 仅 `import type`（编译期擦除）| ✅ 同上 |
| 加载 | `data/*.ts` | `import.meta.glob`（仅 Vite）| ❌ 靠上面两层间接覆盖 |

`data/*.ts` 因此只剩「加载 + 排序 + 转发」三件事。**新写查询逻辑请加到 `lib/article-queries.ts` 并带上测试**，不要往 `data/*.ts` 里塞。
`Article` 类型从 `lib/markdown.ts` 用 `import type` 引入即可——只取类型不会把 marked / prismjs 拖进测试进程。

**数据流**：`content/*.md` → 构建期 `import.meta.glob` 内联进 JS（运行时零文件系统依赖）→ `lib/*` 聚合 → 各页面 RSC 渲染。搜索索引 `/search.json` 与 RSS 同源聚合。`draft: true` 的文章与项目在这一层就被过滤，因此页面、RSS、搜索索引、sitemap、标签云的表现自动一致。

## 关键设计决策（为什么这样做）

1. **vinext（Next.js on Vite）+ React 19 RSC**：要 App Router 心智 + Vite 构建速度 + 服务端渲染的内容页（SEO 友好）+ 最小客户端水合。代价是框架 JS 较大（见性能一节）。
2. **Markdown 构建期内联**：内容必须在构建期进 bundle，运行时不需要文件系统。副作用：改内容必须重新 `npm run build`（dev 模式有 HMR 不受影响）。
3. **字体 unicode-range 分片**：中文 webfont 的体积问题靠「按需加载」解决——浏览器只下载页面实际用到的 unicode-range 片。**注意**：`public/fonts/` 下的整包已删，`fonts-src/` 是 split 工具的输入（本地中间产物，不进 git）。
   - **每字重一个关键片**（`s0`）：三个字重在首页承担的角色差别很大，共用一套字集会让 w400/w700 白背上百个字形（实测：共用 159.7 KB，分离 95.7 KB）。字集由 `CRITICAL_BY_WEIGHT` 定义，采集方法写在脚本头部。
   - **文件名带内容哈希**（`noto-serif-sc-500-s0.11eea0f2.woff2`），因此 nginx 可以设一年 immutable，不必按小时回源校验。
   - **脚本直接改写两个来源**：`app/globals.css` 里 `@font-faces:start/end` 之间的 `@font-face` 块，以及 `lib/font-slices.generated.ts`（关键片清单，供 layout 输出 preload）。
   - **两道自检**：分片码位相交即中止；写入后出现意外收尾文本即中止。另会警告「会上首页的标题用字不在 w500 关键片内」——新增文章时留意。
   - ⚠️ **历史教训**：分片方案曾因 `all_chars - CRITICAL`（int 集合减 str 集合）恒为空操作而整体失效近两周（关键片被后续片遮蔽、从不被浏览器取用）；修复后又因 stdout 解析把脚本收尾文本写进样式表，压缩成选择器 `DONE :root` 导致全站 CSS 变量失效。两件事都写在 `content/articles/chinese-font-slicing-failed.md`。**改这个脚本时请保留自检**。
4. **`next.config.ts` 里 `reactMaxHeadersLength: 0`**：禁用 React 经 HTTP Link 头发的资源提示。三重效果：图片 preload 从 HTTP 头转 HTML 标签（首屏真用了，无警告）、vinext 字体 preload 的 Link 头被禁（app router 字体 preload 只走 HTTP 头渠道）、console 零警告。**别删这个配置**，删了 preload 警告会回来。
5. **吉祥物/主题切换等交互全部渐进增强**：服务端渲染基础态，客户端组件只做增强，JS 失败页面仍完整可读。
6. **明暗主题的配色一律走变量配对，绝不只写一半**：`--ink` / `--paper`、`--card-ink` / `--card-ink-text`、`--tone-violet` / `--tone-violet-ink` 这类都是**成对定义**的。把其中一半写成固定色值，它就会在某个主题下崩掉：
   - `.mail-button[data-copied]` 曾在暗色下变成黑底黑字（对比度 1.03:1），点击后文字整块消失
   - `.project-card.lime` 从来没设过文字色，暗色下继承浅色 `--ink` → 浅字压亮黄绿 **1.70:1**，等于隐形（当时还没有 lime 项目，是潜在 bug）
   - 另一个变体是**面积与亮度成反比**：`--violet` / `--lime` 是点缀色（图标、描边、小圆点），深底上要够亮才看得见；但铺满一整块（CTA、项目卡）时同一个值就成了全页最亮的表面。大面积铺色请用 `--cta-bg` / `--tone-*`
   - 批量排查：`grep -E '(color|background):\s*#[0-9a-fA-F]{3,6}' app/globals.css`
   - 仅有的例外是 `app/global-error.tsx`（它会替换 `html`/`body`，不能依赖站点 CSS），不要改
7. **改动样式后要验交互状态与共用的类名**：
   - 静态截图看不到 `:hover` / `:focus` / `[data-*]` 状态，而这类状态正是最容易配色出错的地方
   - 删样式前先 `grep` 类名：`project-rail-footer` 曾是**项目区与文章区共用**的（名字带着 `project-` 却跨区域），删项目区时把文章区的分页脚一起打掉了。现名为 `.rail-footer`
8. **公安部备案与 ICP 备案放在 `layout.tsx`，不放首页的 `.site-footer`**：备案号必须在网页源码底部可见，而且**每一页都得有**——只放首页页脚的话，爬到文章页的检查看不到它。所以它是 `layout` 里 `<body>` 的最后一个渲染元素（其后只剩 Next 的模块脚本）。
   - 顺序：ICP（`beian.miit.gov.cn`，不要求图标）在前，公安（`beian.mps.gov.cn`）在后。
   - 公安图标 `public/beian-gongan.png`（下载件原样，36×40，展示 18×20 正好 2x 覆盖）。**别转 WebP、别重压**——备案徽标要求原样使用，而且它只有 1.4 KB。图标在编号之前（官方要求）。
   - 不走 `next/image`（有 `oxlint-disable` 豁免，与站内其他 `<img>` 同一惯例）。
   - nginx 的图片规则会直服它（实测 `200 / image/png / 1403 bytes / max-age=604800`）。
   - 窄屏需要 `padding-bottom: 74px`：右下角固定搜索按钮（`bottom: 16px`、高 46px）占着离底 16–62px 这条带，而两条备案号并排约 342px 几乎铺满 390px 视口，无论怎么对齐都会从按钮底下穿过。

## 性能现状与瓶颈

**首屏传输**（2026-09-20，Lighthouse 移动端口径）：

| 类型 | 传输 | 说明 |
| --- | --- | --- |
| JS | **175 KB** | 其中框架 ~140 KB（gzip）——现在是最大一项 |
| 图片 | **129 KB**（移动）/ **45 KB**（桌面）| 肖像图改响应式后按 DPR 选档 |
| 字体 | **96 KB**（3 个）| 三个关键片，preload 并行下载 |
| CSS | 18 KB | |
| 文档 | 12 KB | |
| **合计** | **~473 KB** | 优化前 1,038 KB |

Lighthouse 13.4.1 实测（模拟限速，同口径）：

| 指标 | 移动端（412×823 @1.75）| 桌面端（1350×940 @1）|
|---|---|---|
| Performance | **93–97**（3 次，±4 波动）| **77** |
| Accessibility / Best Practices / SEO | 100 / 100 / 100 | 100 / 100 / 100 |
| FCP | 1.7 s | 1.7 s |
| LCP | 2.4–2.8 s | 2.7 s |
| TBT | **0 ms** | **0 ms** |
| CLS | **0** | **0** |

- **剩余瓶颈是框架 JS**（175 KB），vinext beta 固有成本，等稳定版。其次是字体 96 KB（中文衬线三字重的关键片总和，已经按字重拆过）。
- **图片已经不是瓶颈**。肖像图现在是 5 档响应式（320/480/640/800/1024），并且移出了关键路径（`loading="lazy"`——它在所有视口下都在首屏之外）。实测移动端挑 640、真桌面 1350 挑 480，三次选择都正确且清晰（`sharpRatio` ≥ 1）。
- **下一步可做的**（按性价比）：字体按页面类型给不同字集（比关键片更彻底）、按需加载 `code-block-enhancer` 依赖的 prismjs 语言包。
- **已做过但收益有限的**：肖像图重编码到 q78（只省 6%，用主视觉画质换 9 KB 不划算，放弃——但**尺寸**过剩是另一回事，已由响应式解决）；小狗图保持单一 192×192（覆盖 3.5× DPR；它是 LCP 元素，多档选择的开销换不回 3 KB）。
- **`screenEmulation.disabled` 不等于桌面口径**：它会退回 headless 默认窗口（≈720 px），拿到的是中间尺寸的数据。要真桌面视口得显式给 `--screenEmulation.width=1350 --screenEmulation.height=940 --screenEmulation.deviceScaleFactor=1`。

## 已知坑（血泪经验，务必读）

### Windows / PowerShell
- **含中文的文件编辑一律用 Python**（`io.open` + `encoding="utf-8"` + `newline="\n"`）。PowerShell `Get-Content`（无 -Encoding）按 GBK 解码 UTF-8，`Set-Content` 写回 = 乱码固化；`-NoNewline` + 数组拼接 = 丢换行。曾因此损坏 globals.css，靠 git restore 恢复。
- **含引号 / 反斜杠的多行中文提交信息会被 PowerShell 解析坏**（`\"` 会断行 → `error: pathspec ... did not match`）。改用写一个消息文件 + `git commit -F <file>`，提交后删掉。
- **验证横向溢出必须用 `clientWidth`，不能用 `innerWidth`**：后者含滚动条宽度（桌面 15px），于是 `scrollWidth > innerWidth` 这个判据在出现滚动条时**恒为 false**，会静默漏报所有横向溢出。正确：`documentElement.scrollWidth > documentElement.clientWidth`；更硬的证据是真的去滚一下看 `scrollX > 0`。曾因为写错判据三次报告过“移动端无横向滚动”，实际有三个元素在撑宽页面。
- **PowerShell `>` 重定向输出是 UTF-16 LE**：Python 读它要 `encoding="utf-16"`；**二进制文件（字体/图片）绝不能用 PowerShell `>` 从 git 恢复**（会膨胀 2 倍损坏），用 `cmd /c "git cat-file blob <sha> > file"`。
- **python stdin 管道传中文会变 `?`**：脚本里避免中文路径字面量，用相对路径（工作目录已是项目根）或写临时 .py 文件再跑。
- `git push` 的 stderr 报 exit code 1 是 PowerShell 误报，看到 `main -> main` 就是成功。

### Lighthouse / 测试口径
- **同口径才可比**：`--throttling-method=provided`（真实环境）与默认模拟口径分数差 30 分，别混着比。
- **headless Chrome 光栅化怪癖**：observedLoad 393ms 但 observedFCP 2377ms、observedLCP undefined——provided 口径在 headless 下不可信，以模拟口径 + 真实浏览器体验为准。
- 移动视口 reload + 缓存命中场景，Chrome 会误报字体 preload 警告；干净加载（新开无痕）才是真信号。
- Lighthouse JSON 700KB，PowerShell `ConvertFrom-Json` 会爆，用 node 脚本解析。

### vinext / 框架
- **字体 preload 必须手写**：vinext 的字体 preload 只走 HTTP Link 头（dev-server.js 源码确认），而 `reactMaxHeadersLength: 0` 会把它一起禁掉。所以由 `layout.tsx` 用 `react-dom` 的 `preload()` 补上。
  - ⚠️ **不要改回手写 `<link rel="preload">`**：React 19 会把 `<link>` 自动提升进 `<head>`，手写的话同一份 preload 会被输出两遍（实测 6 条）。`preload()` 是官方为此提供的 API，只发一条。
  - 清单来自 `lib/font-slices.generated.ts`（由 `split-fonts.py` 生成），因为文件名带哈希，**不能硬编码**。
- **standalone 包缺 react 系依赖**（beta.9）：打包器把 react/react-dom 捆进 server bundle，但原样拷贝的 vinext/dist 运行时仍以 peer 方式 import react，启动即 `ERR_MODULE_NOT_FOUND: Cannot find package 'react'`。`scripts/fix-standalone.mjs`（npm postbuild 钩子）自动补齐 react/react-dom/react-server-dom-webpack/scheduler/marked/prismjs。
- **Windows 构建怪癖（2026-09-17 查明根因）**：本机路径含非 ASCII（`…\牛马工作区\site`）时，Node 的 `fs.rmSync(dir, {recursive:true, force:true})` 会**整体静默失效** —— 报 `errno 0`「操作成功完成」却一个文件都不删（`force:true` 又吞掉异常）。后果：旧 `dist/standalone/dist/client/.assetsignore` 残留，vinext 的 standalone 产出阶段用 `cpSync` 覆盖旧文件时 unlink 报错，构建中断；`maxRetries` 无效，加 `\\?\` 前缀是 Node 内部行为（手动 `readdir` + `unlink`/`rmdir` 走另一分支，实测 4000+ 文件零失败）。**已由 `scripts/clean-dist.mjs` 取代**（`npm run build` 第一步就调用它），别再改回 `rmSync`。
- 构建产物预览必须用 `npm run start`（wrangler dev 跑 `dist/server/wrangler.json`），改代码后要重新 build。
- wrangler dev 偶发缓存旧资产：停进程 → 删 `.wrangler/state/v3/cache` → 重启。

### nginx / 静态资源
- **HTML 的缓存头靠 `map $upstream_http_cache_control` 判断**，不是无条件 `add_header`：后者会与接口自带的 `Cache-Control` 并存，两个头叠加后 `no-cache` 会默默把 `/rss.xml`、`/search.json` 的缓存关掉。
- **静态文件的 location 用 `try_files $uri @app` 回落**，不能写 `=404`：`/robots.txt` 是应用动态生成的，不在 `public/` 里。
- **`/home/xwsx` 需为 711**：nginx（www-data）要靠 `--x` 穿越家目录，750 会让所有直服 404，而且从外部看只是「资源不见了」，很难联想到权限。

## 本地验证工作流（改完代码后）

```bash
npm run dev         # 本地开发服务器 :3000，HMR
npm run lint        # oxlint
npm test            # node --test（解析 / 查询 / 机器接口 / 样式表断言）
npm run check       # 静态断言：globals.css 结构 + 字形覆盖（build 第一步就跑）
npm run build       # 必须过，CI 同款
npm run start       # wrangler dev :8787 预览构建产物
```

**工作流：先本地、后部署。** 改完在 `npm run dev` 的本地站上验好（含明暗主题、窄屏、交互状态），确认没问题再 `npm run deploy` 一次上去。不要每改一点就部署——线上是给人看的，不是调试台。

浏览器验证清单：console 零警告、明暗两主题、移动视口（390px）布局、小狗吉祥物气泡、搜索面板。Lighthouse 复测用固定命令（见上文口径提醒）。

**改样式表、构建脚本或任何会改写源文件的工具之后，务必看一眼页面截图。** 2026-09-18 出过一次事故：脚本的收尾文本混进样式表，压缩后与 `:root` 拼成匹配不到元素的选择器，全站 CSS 变量失效（满屏颗粒、背景透明）。当时验证了字体请求、字形渲染、OG 图片——**每一项都是「我改的东西」，没有一项是「页面整体」**。详见 ROADMAP 的「为什么『看一眼截图』是单独一条」。

**看宽屏布局用同源 iframe，别用 CDP 改视口。** 内嵌浏览器的可见表面通常只有 ~500px 宽，`Emulation.setDeviceMetricsOverride` 也扩大不了它（而且状态会中途失效，同一批操作里能从 1280 弹回 504）。可靠做法：在本地站的页面里插一个 `width:1440px` 的 iframe（`src="/"`，同源所以能读 `contentDocument`），先在主页面执行过一次脚本注入 `.reveal{opacity:1!important}` 让动画元素显形，再 `page.locator('#probe').screenshot()`。

## 待办与建议路线

迭代计划与详细待办见 [ROADMAP.md](./ROADMAP.md)。要点：

1. **内容维护节奏**：新文章 → `npm run og` → 用字有变化时跑字体分片（README「写一篇文章」第 4 步）。
2. **新内容尽量基于真实经历**。此前有一批占位内容已撤下（见「内容状态」），**编造的细节比空着更伤可信度**。
3. **已交付**：中文排版字距、可读性与触控目标、版面构图、错误页面、内容治理、04 区能力范围、CTA 渐变、首屏传输优化（1038 → 476 KB）、测试与结构、以及**两条静态断言门禁**（样式表结构 / 字形覆盖，见 ROADMAP 第 5 批）。逐条记录与实测数字在 ROADMAP。
4. **待确认的小修正**（行为变更，需你点头）：阅读时长把换行算作字数、标签重复计数、同日文章排序不稳。三条都在 ROADMAP「待办 · 小修正」。
5. **公安备案已上线**（2026-09-20）：粤公网安备44180202001182号，在 `layout.tsx` 里做成全站底部一行（`.site-filing`），图标在编号之前。为什么要全站而不是只放首页页脚，见「关键设计决策」第 8 条。

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
