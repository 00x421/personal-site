/**
 * 机器可读接口（RSS / 搜索索引 / sitemap）的**序列化层**。
 *
 * 为什么单独抽一层：这三个接口原本把「取数据 + 拼字符串」写在 route 里，
 * 而 route 依赖 `@/data/*`，那个模块用 eager 的 `import.meta.glob('?raw')`
 * 内联全部 Markdown 原文——只有 Vite 能跑，`node --test` 碰不了。于是站点
 * 上最容易出错的一环（XML 转义、URL 拼接、text 归一化）**一行测试都没有**。
 *
 * 拆法与 `lib/article-queries.ts` 完全一致：收「已经是数组的数据」，返回
 * 字符串/数组，运行时零 import（`Article`/`Project` 只用 `import type` 引入，
 * 编译期擦除；`escapeXml` 来自零依赖的 `content-parse.ts`）。
 * route 从此只剩「取数据 → 喂给这里 → 包成 Response」三件事。
 *
 * 注意：这一层**不做 draft 过滤**——那是加载层的职责（`data/*.ts` 已在
 * 更上游滤掉），在这里再滤一次会让两处规则有机会漂移。
 */

import { escapeXml } from './content-parse.ts';
import type { Article, Project } from './markdown.ts';

/** 序列化只需要这些字段。用 Pick 绑住真实类型，避免两份定义悄悄漂移。 */
export type FeedArticle = Pick<
  Article,
  'slug' | 'title' | 'description' | 'published' | 'tags' | 'html'
>;
export type FeedProject = Pick<
  Project,
  'slug' | 'title' | 'summary' | 'tags' | 'type' | 'year' | 'html' | 'hasCase'
>;
/** 刻意写成结构化类型：`lib/` 不该反向依赖 `data/books.ts`（那是加载层）。
    `Book` 的结构与它兼容，所以调用处无需转换。 */
export type FeedBook = {
  title: string;
  author: string;
  status: string;
  takeaway: string;
};

export type SearchEntry = {
  type: 'article' | 'project' | 'book';
  title: string;
  desc: string;
  tags: string[];
  url: string;
  /** 结果行展示的次要信息（日期 / 类型年份 / 作者状态）。 */
  meta: string;
  /** 供全文匹配的小写纯文本（标题 + 描述 + 标签 + 正文）。 */
  text: string;
};

/** RSS 频道元信息，来自 `lib/site-content.ts`（调用方传入，本层不读站点常量）。 */
export type RssChannel = {
  title: string;
  description: string;
  /** 站点绝对 URL，无尾斜杠（如 https://xwsx.top）。 */
  baseUrl: string;
};

/**
 * RSS 2.0。输出格式与拆分前逐字节一致。
 *
 * 转义只覆盖文本节点（title / description / category）——`<link>` 与
 * `<guid>` 里放的是我们自己拼的 URL，不含需要转义的字符，与拆分前保持
 * 一致以免改变已有订阅者的解析结果。
 */
export function buildRssXml(articles: FeedArticle[], channel: RssChannel): string {
  const { baseUrl, title, description } = channel;
  const items = articles
    .map((article) => {
      const url = `${baseUrl}/articles/${article.slug}`;
      return [
        '    <item>',
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(article.published).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(article.description)}</description>`,
        `      ${article.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>zh-CN</language>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}

/** 去掉 HTML 标签，把正文压成一行纯文本（搜索索引的全文匹配用）。 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toText(...parts: string[]): string {
  return parts.join(' ').toLowerCase();
}

/**
 * 全站搜索索引。文章 / 项目 / 书架三种来源在这里汇成一个数组，
 * 前端（`components/site/site-search.tsx`）只认 `SearchEntry` 的字段。
 */
export function buildSearchEntries(input: {
  articles: FeedArticle[];
  projects: FeedProject[];
  books: FeedBook[];
}): SearchEntry[] {
  const { articles, projects, books } = input;
  return [
    ...articles.map((article) => ({
      type: 'article' as const,
      title: article.title,
      desc: article.description,
      tags: article.tags,
      url: `/articles/${article.slug}`,
      meta: article.published,
      text: toText(
        article.title,
        article.description,
        article.tags.join(' '),
        stripHtml(article.html),
      ),
    })),
    ...projects.map((project) => ({
      type: 'project' as const,
      title: project.title,
      desc: project.summary,
      tags: project.tags,
      // 有正文才有案例页，否则回到首页项目区
      url: project.hasCase ? `/projects/${project.slug}` : '/#work',
      meta: `${project.type} · ${project.year}`,
      text: toText(
        project.title,
        project.summary,
        project.tags.join(' '),
        project.type,
        stripHtml(project.html),
      ),
    })),
    ...books.map((book) => ({
      type: 'book' as const,
      title: book.title,
      desc: book.takeaway,
      tags: [book.status],
      url: '/books',
      meta: `${book.author} · ${book.status}`,
      text: toText(book.title, book.author, book.status, book.takeaway),
    })),
  ];
}

/** 与 `MetadataRoute.Sitemap` 结构兼容，但本层不 import next（保持零运行时依赖）。 */
export type SitemapEntry = { url: string; lastModified: Date };

/**
 * sitemap。只有**写了正文**的项目才有案例页，所以 `hasCase` 为假的项目和
 * draft 的项目一样不进 sitemap —— 否则会提交一批 404 给搜索引擎。
 *
 * `now` 可注入：静态页的 lastModified 用同一个时间戳（原来是四次 `new
 * Date()`，相隔不到 1ms，合并成一个纯粹是为了让测试可断言）。
 */
export function buildSitemapEntries(input: {
  articles: FeedArticle[];
  projects: FeedProject[];
  baseUrl: string;
  now?: Date;
}): SitemapEntry[] {
  const { articles, projects, baseUrl } = input;
  const now = input.now ?? new Date();
  return [
    { url: baseUrl, lastModified: now },
    { url: `${baseUrl}/articles`, lastModified: now },
    { url: `${baseUrl}/books`, lastModified: now },
    { url: `${baseUrl}/now`, lastModified: now },
    ...articles.map((article) => ({
      url: `${baseUrl}/articles/${article.slug}`,
      lastModified: new Date(article.published),
    })),
    ...projects
      .filter((project) => project.hasCase)
      .map((project) => ({
        url: `${baseUrl}/projects/${project.slug}`,
        lastModified: now,
      })),
  ];
}
