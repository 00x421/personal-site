---
title: 用 Markdown 和 RSC 搭一个站，然后把它跑在一台服务器上
description: 一个个人站的技术选型记录：内容用 Markdown 在构建期内联，页面用 React 服务端组件渲染，产物用 systemd 跑在一台自托管服务器上。包含真实的性能账本和还没还的债。
published: 2026-09-17
tags: [工程实践, 前端, 架构]
series: 工程手记
---

## 一句话版本

内容是一堆 Markdown 文件，构建期编译成 HTML 和少量 JS，产物交给一台服务器上的 Node 进程托管。没有数据库，没有后台，没有评论系统。写文章就是在编辑器里新建一个 `.md`。

## 内容层：Markdown 加 frontmatter

文章、项目案例、书架共用一套格式。每篇文章是 `content/articles/` 下的一个文件，文件名就是 URL：

```markdown
---
title: 用 Markdown 和 RSC 搭一个站
description: 一句话摘要，列表页、SEO、社交分享图都用它。
published: 2026-09-17
tags: [工程实践, 前端]
series: 工程手记
---

## 正文从这里开始
```

解析出来是一个纯对象，标签聚合、系列导航、相关阅读都在这个对象上做——一百来行没有依赖的函数。

关键的一步是内容怎么进到页面里：

```ts
const files = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const articles = Object.entries(files)
  .map(([path, raw]) => buildArticle(path.split('/').pop()!.replace(/\.md$/, ''), raw))
  .filter((article) => !article.draft)
  .sort((a, b) => b.published.localeCompare(a.published));
```

`import.meta.glob` 在**构建期**把文件原文读进来内联到产物里。跑起来的进程完全不需要碰文件系统——这一点在换成自托管之后依然有价值，因为它让「部署」退化成了「拷贝一份目录」。

`draft: true` 的文章会在这一步被过滤掉，于是 RSS、搜索索引、sitemap、标签云全部同步消失，因为它们共用同一个数组。

## 渲染层：React 服务端组件

构建产物里，内容页面是不带组件代码的 HTML。浏览器收到的 JS 只负责几个真正需要交互的地方：主题切换、站内搜索、两个横向滚动的轨道、阅读进度条。

这些交互件全部按**渐进增强**写：服务端先渲染出可用的基础态，客户端组件只是给它加行为。代码块的语言标签和复制按钮，是在浏览器里找到服务端已经渲染好的 `<pre>` 元素再做包装；搜索面板用的是原生 `<dialog>`；主题切换直接读写 `<html data-theme>` 和 localStorage，没有 React 状态参与。JS 加载失败时，页面仍然完整可读。

选 RSC 的动机很实际：想在一个真实的、随时能改的项目里熟悉这套心智模型——「服务端组件永远不发到浏览器」这条约束在日常工作里越来越常见，但真正上手的机会不多。

**代价要说清楚。** 这个选择并不便宜。当前构建产物的框架代码是 535KB（React 186KB + vinext 130KB + 业务代码和运行时），在 Lighthouse 的模拟移动网络口径下性能分是 66，LCP 5.5 秒。对一个内容站来说这个数字不好看，而它是框架层面的固有成本，我没有通过优化应用代码把它降下来的办法。

## 交付层：为什么最后跑在一台服务器上

框架是 vinext（一个把 Next.js 应用路由子集跑到 Vite 上的实现）。它提供 `output: 'standalone'`，能产出一份自带 Node 入口的目录：

```
dist/standalone/
  server.js
  node_modules/
  dist/client/     # 静态资源
  public/
```

部署就是打包这个目录、上传、解包、重启进程。服务器上是一个 systemd 服务，`node server.js` 绑在 `127.0.0.1:3000`，前面用 nginx 做 TLS 终止和反向代理，证书走 Let's Encrypt 自动续期。

整个过程我写成了一个脚本，本地一条命令跑完：

```bash
npm run deploy
```

它依次做：清空构建产物、构建、补齐运行时依赖、打包、scp 上传、在服务器上备份旧版本后解包、重启服务、健康检查——健康检查失败就自动把旧版本换回来。

选择自托管而不是边缘平台，主要原因是这套流程的**可观测性**：出问题时我能直接 `ssh` 上去看进程状态、nginx 日志和 systemd 日志，而不是隔着平台的控制台猜。

## 一个 beta 版的坑

standalone 产物有个问题，打包器把 `react` 和 `react-dom` 捆进了 server bundle，但原样拷贝过来的框架运行时仍然以 peer 依赖的方式 `import react`，进程一启动就 `ERR_MODULE_NOT_FOUND`。

对策是一个 postbuild 钩子，把缺的几个包从本地 `node_modules` 拷进产物：

```js
const packages = ['react', 'react-dom', 'react-server-dom-webpack', 'scheduler', 'marked', 'prismjs'];
```

它在 `npm run build` 之后自动跑，所以构建和修复是一步。

## 性能账本

当前的数字，模拟 Fast 4G（Lighthouse 移动端默认口径）：

| 指标 | 值 |
| --- | --- |
| Performance | 66 |
| LCP | 5.5s |
| FCP | 4.6s |
| 总传输 | 约 1.2MB |

拆开看，1.2MB 里最大的一块是字体——这个数字背后有个我没解决的问题，单独写了一篇：[我把中文字体切成 21 片，首屏还是下了 383KB](/articles/chinese-font-slicing-failed)。剩下的主要是框架 JS。

真实浏览器下的体验比模拟值好一些，因为静态资源有长缓存，字体分片命中缓存后不再请求。但 535KB 的框架 JS 每次都要重新解析执行。

## 还没还的债

- **框架 JS**：等 vinext 稳定版，或者换掉它。
- **字体分片没有按设计工作**：上面那篇里有完整测量和原因。
- **没有测试**。内容解析、标签聚合、相关阅读都是纯函数，用 Node 自带的 `node --test` 就能覆盖，但目前一个都没有。这个站已经出过几次「改了 A 悄悄影响 B」的问题，都是靠肉眼发现。
- **样式表是一个两千多行的文件**。分区和注释做得还算清楚，但它没法做作用域隔离，改动的影响范围只能靠读。

这些我打算一条一条慢慢还。写下来是因为它们在站点自己的文档里比在这里更容易被忘记。
