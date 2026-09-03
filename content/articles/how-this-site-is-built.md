---
title: 这个网站是怎么搭起来的
description: 用 React Server Components 跑在 Cloudflare Workers 上的静态优先个人站：架构选型、Markdown 内容管线，以及为什么开发体验比功能清单更重要。
published: 2026-08-20
tags: [工程实践, 前端]
---

## 先说结论

这个网站的全部内容——文章、项目案例、书架——都是 Markdown 文件。构建时被编译成静态页面，部署在 Cloudflare Workers 的边缘节点上。没有数据库，没有后台管理系统，没有评论系统。

用 Git 写作，用 PR 改版，用构建产物发布。内容即代码。

## 为什么选 RSC 而不是纯静态

大多数个人站用 Astro 或 Hugo 就够了。我选 vinext（一个把 Next.js 应用路由子集跑到 Workers 上的微型框架）是因为想在个人项目里持续练习 React Server Components 的心智模型——它在工作里越来越常见，但真正上手的机会不多。

RSC 的核心约束是：**服务端组件永远不发货到浏览器**。数据和 Markdown 解析都发生在构建期或边缘节点，浏览器只收到渲染好的 HTML 加少量交互岛：

```tsx
// 服务端组件：构建时执行，产物是 HTML 字符串
export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tagged = getArticlesByTag(slug);
  return <ArticleList items={tagged} />;
}
```

整页只有一个地方需要水合——阅读进度条和主题切换这样的小组件。首屏 JS 体积因此可以忽略不计，Lighthouse 的性能分不再是玄学。

## Markdown 内容管线

每篇文章的 frontmatter 只有五个字段。解析、排序、标签聚合、相关文章推荐，全部是一百来行没有依赖的纯函数：

```ts
const files = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const articles = Object.entries(files)
  .map(([path, raw]) => buildArticle(path.split('/').pop()!, raw))
  .filter((article) => !article.draft)
  .sort((a, b) => b.published.localeCompare(a.published));
```

`import.meta.glob` 在构建期把文件内容内联进产物，Workers 运行时不需要文件系统——这是整个管线能在边缘跑起来的关键。

代码高亮用 Prism 在服务端完成，输出纯 HTML 加 class。复制按钮是一个极小的客户端组件，在浏览器里给已有的 `pre` 元素做渐进增强：

```ts
marked.use({
  renderer: {
    code({ text, lang }) {
      return `<pre data-lang="${lang}"><code>${highlightCode(text, lang)}</code></pre>`;
    },
  },
});
```

## 部署即一条命令

```bash
npm run build    # 编译 RSC → 静态 HTML + 边缘路由
npx wrangler deploy
```

Workers 免费额度每天十万次请求，对个人站绰绰有余。构建产物是全球分布式的一份静态资产加一个瘦路由层，不存在「服务器挂了」这个概念。

## 值不值得抄

如果只是想写博客，这套架构是过度工程。但如果你和我一样，把个人站当作**新技术的低风险试验田**——在这里踩 RSC、边缘计算、OG 图自动生成的坑，比在生产环境里第一次遇到它们便宜得多。

工程的意义不是堆功能，而是让「写下一段文字 → 发布」这条路径短到没有借口。
