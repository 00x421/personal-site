import { articles } from '@/data/articles';
import { projects } from '@/data/projects';
import { books } from '@/data/books';

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

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toText(...parts: string[]) {
  return parts.join(' ').toLowerCase();
}

/** 全站搜索索引：与 rss.xml 同模式，构建期内容内联，运行时零文件系统。 */
export function GET() {
  const entries: SearchEntry[] = [
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

  return new Response(JSON.stringify(entries), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
