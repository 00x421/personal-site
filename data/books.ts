export type BookStatus = '在读' | '读完' | '想读';

export type Book = {
  slug: string;
  title: string;
  author: string;
  status: BookStatus;
  /** 开始阅读的年月，用于组内排序（新在前）。 */
  started: string;
  /** 一句话心得；想读阶段可为空。 */
  takeaway: string;
};

type RawFrontmatter = Record<string, string>;

function parseFrontmatter(raw: string): RawFrontmatter {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return {};
  const data: RawFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return data;
}

function toBook(path: string, raw: string): Book {
  const data = parseFrontmatter(raw);
  const status = data.status;
  return {
    slug: path.split('/').pop()!.replace(/\.md$/, ''),
    title: data.title ?? '未命名',
    author: data.author ?? '',
    status: status === '读完' || status === '想读' ? status : '在读',
    started: data.started ?? '',
    takeaway: data.takeaway ?? '',
  };
}

// Vite 在构建期把 content/books/*.md 原文内联进产物，Workers 运行时无需文件系统。
const files = import.meta.glob('/content/books/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const books: Book[] = Object.entries(files)
  .map(([path, raw]) => toBook(path, raw))
  .sort((a, b) => b.started.localeCompare(a.started) || a.title.localeCompare(b.title));

export const bookStatuses: BookStatus[] = ['在读', '读完', '想读'];

export function booksByStatus(status: BookStatus): Book[] {
  return books.filter((book) => book.status === status);
}
