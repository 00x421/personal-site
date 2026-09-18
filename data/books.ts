import { readString, splitFrontmatter } from '@/lib/content-parse';

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

/** 书籍的 frontmatter 解析复用 lib/content-parse.ts。
    这里曾经自己写了一份，与 lib/markdown.ts 的行为会静默漂移
    （引号处理就是这样两处一起修的），现在统一。 */
function toBook(path: string, raw: string): Book {
  const { data } = splitFrontmatter(raw);
  const status = readString(data, 'status');
  return {
    slug: path.split('/').pop()!.replace(/\.md$/, ''),
    title: readString(data, 'title') ?? '未命名',
    author: readString(data, 'author') ?? '',
    status: status === '读完' || status === '想读' ? status : '在读',
    started: readString(data, 'started') ?? '',
    takeaway: readString(data, 'takeaway') ?? '',
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
