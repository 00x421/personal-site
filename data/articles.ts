import { buildArticle, type Article } from '@/lib/markdown';
import {
  collectTags,
  filterByTag,
  findAdjacent,
  findBacklinks,
  findRelated,
  findSeries,
  sortByNewest,
} from '@/lib/article-queries';

export type { Article };

// 本文件只负责「文章从哪来」：构建期内联 Markdown 原文，然后按发布顺序排好。
// 所有查询逻辑都在 lib/article-queries.ts（纯函数，可在 Node 下测试）。
//
// Vite 在构建期把 content/articles/*.md 原文内联进产物，Workers 运行时无需文件系统。
// （scripts/generate-og.ts 在纯 Node 下运行，走 lib/markdown.ts + fs 自行加载。）
const files = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const articles: Article[] = sortByNewest(
  Object.entries(files)
    .map(([path, raw]) => buildArticle(path.split('/').pop()!.replace(/\.md$/, ''), raw))
    .filter((article) => !article.draft),
);

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function getAdjacent(slug: string) {
  return findAdjacent(articles, slug);
}

export function getRelated(slug: string, max = 2) {
  return findRelated(articles, slug, max);
}

export function getArticlesByTag(tag: string) {
  return filterByTag(articles, tag);
}

export function getAllTags() {
  return collectTags(articles);
}

export function getBacklinks(slug: string) {
  return findBacklinks(articles, slug);
}

export function getSeries(series: string | undefined) {
  return findSeries(articles, series);
}
