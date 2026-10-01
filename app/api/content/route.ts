import { readList, readString, splitFrontmatter } from '@/lib/content-parse';
import { buildProject } from '@/lib/markdown';
import { books } from '@/data/books';
import { capabilities, siteDescription, siteIdentity, siteTitle, toolbox } from '@/lib/site-content';

/**
 * 站点内容的机器可读全文出口（MCP server 与其它 Agent 工具的数据源）。
 *
 * 与 RSS / search.json 同一条数据纪律：draft 在这里过滤，页面、RSS、
 * 搜索、本端点的表现自动一致。给 LLM 读的是 markdown 原文而非渲染 HTML
 * （干净、省 token），因此 route 内自包含地 glob 原文，不动 data 层与
 * Article 类型。解析结果在模块作用域缓存——构建期内联的 raw 不变，无需重复解析。
 */

const articleFiles = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const projectFiles = import.meta.glob('/content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type ContentPayload = {
  site: { title: string; description: string; url: string; brand: string; name: string; motto: string };
  articles: {
    slug: string;
    title: string;
    description: string;
    published: string;
    readTime: string;
    tags: string[];
    series?: string;
    content: string;
  }[];
  projects: {
    slug: string;
    title: string;
    type: string;
    year: string;
    summary: string;
    tags: string[];
    status: string;
    eyebrow: string;
    meta: string[];
    deliverables: string[];
    hasCase: boolean;
    content: string;
  }[];
  books: { slug: string; title: string; author: string; status: string; started: string; takeaway: string }[];
  about: { capabilities: { name: string; focus: boolean; detail: string }[]; toolbox: [string, string[]][]; contact: { email: string; github: string } };
};

let cached: ContentPayload | null = null;

function buildPayload(): ContentPayload {
  const articles = Object.entries(articleFiles)
    .map(([path, raw]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '');
      const { data, body } = splitFrontmatter(raw as string);
      return {
        slug,
        title: readString(data, 'title') ?? slug,
        description: readString(data, 'description') ?? '',
        published: readString(data, 'published') ?? '',
        tags: readList(data, 'tags'),
        series: readString(data, 'series'),
        draft: readString(data, 'draft') === 'true',
        content: body,
      };
    })
    .filter((article) => !article.draft)
    .sort((a, b) => b.published.localeCompare(a.published));

  const projects = Object.entries(projectFiles)
    .map(([path, raw]) => {
      const slug = path.split('/').pop()!.replace(/\.md$/, '');
      const project = buildProject(slug, raw as string);
      const { body } = splitFrontmatter(raw as string);
      return { project, body };
    })
    .filter(({ project }) => !project.draft)
    .map(({ project, body }) => ({
      slug: project.slug,
      title: project.title,
      type: project.type,
      year: project.year,
      summary: project.summary,
      tags: project.tags,
      status: project.status,
      eyebrow: project.eyebrow,
      meta: project.meta,
      deliverables: project.deliverables,
      hasCase: project.hasCase,
      content: project.hasCase ? body : '',
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const readTime = (body: string) =>
    `${Math.max(1, Math.ceil(body.replace(/\s/g, '').length / 400))} min read`;

  return {
    site: {
      title: siteTitle,
      description: siteDescription,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://xwsx.top',
      brand: siteIdentity.brand,
      name: siteIdentity.name,
      motto: siteIdentity.motto,
    },
    articles: articles.map(({ draft: _draft, ...rest }) => ({
      ...rest,
      readTime: readTime(rest.content),
    })),
    projects,
    books: books.map(({ slug, title, author, status, started, takeaway }) => ({
      slug,
      title,
      author,
      status,
      started,
      takeaway,
    })),
    // 站点自述（04 区能力清单 / 工具箱 / 联系方式）——「RPA」「怎么联系」
    // 这类站点级关键词只存在于这里，不导出就是检索盲区
    about: {
      capabilities: capabilities.map((c) => ({ name: c.name, focus: c.focus ?? false, detail: c.detail })),
      toolbox: toolbox.map(([level, items]) => [level, [...items]]),
      contact: { email: siteIdentity.email, github: siteIdentity.github },
    },
  };
}

export function GET() {
  cached ??= buildPayload();
  return new Response(JSON.stringify(cached), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 内容一天一更的频率；1 小时缓存 + nginx map 原样放行该头
      'cache-control': 'public, max-age=3600',
    },
  });
}
