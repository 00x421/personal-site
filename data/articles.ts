import { buildArticle, type Article } from '@/lib/markdown';

export type { Article };

// Vite 在构建期把 content/articles/*.md 原文内联进产物，Workers 运行时无需文件系统。
// （scripts/generate-og.ts 在纯 Node 下运行，走 lib/markdown.ts + fs 自行加载。）
const files = import.meta.glob('/content/articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const articles: Article[] = Object.entries(files)
  .map(([path, raw]) => buildArticle(path.split('/').pop()!.replace(/\.md$/, ''), raw))
  .filter((article) => !article.draft)
  .sort((a, b) => b.published.localeCompare(a.published));

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

/** 列表按发布日期倒序：newer 为索引更小的一篇，older 为更早的一篇。 */
export function getAdjacent(slug: string): {
  newer: Article | null;
  older: Article | null;
} {
  const index = articles.findIndex((article) => article.slug === slug);
  if (index === -1) return { newer: null, older: null };
  return {
    newer: index > 0 ? articles[index - 1] : null,
    older: index < articles.length - 1 ? articles[index + 1] : null,
  };
}

/** 标签重叠最多的文章；无重叠时回退为最新的其他文章，避免区块永远为空。 */
export function getRelated(slug: string, max = 2): Article[] {
  const self = getArticle(slug);
  if (!self) return [];
  const others = articles.filter((article) => article.slug !== slug);
  const scored = others
    .map((article) => ({
      article,
      score: article.tags.filter((tag) => self.tags.includes(tag)).length,
    }))
    .sort(
      (a, b) =>
        b.score - a.score || b.article.published.localeCompare(a.article.published),
    );
  const tagged = scored.filter((entry) => entry.score > 0);
  return (tagged.length > 0 ? tagged : scored)
    .slice(0, max)
    .map((entry) => entry.article);
}

export function getArticlesByTag(tag: string): Article[] {
  return articles.filter((article) => article.tags.includes(tag));
}

/** 全站标签按文章数倒序，同级按名称稳定排序。 */
export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of article.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
