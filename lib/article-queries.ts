import type { Article } from './markdown.ts';

/**
 * 文章集合的查询逻辑，全部是**接收 Article[] 的纯函数**。
 *
 * 之所以把这一层从 `data/articles.ts` 里拆出来：那个文件用 `import.meta.glob`
 * 在构建期内联 Markdown 原文，只有 Vite 环境能跑，Node 测试进程碰不了。
 * 查询本身和“文章从哪来”无关，拆开后就能用 `node --test` 直接覆盖。
 *
 * `Article` 只用 `import type` 引入，编译期即被擦除——所以本模块运行时**零 import**。
 */

/**
 * 按发布日期倒序（新的在前）。
 *
 * 刻意**不加第二排序键**：同日发布的文章（本站有三篇 2026-09-17）在原来就依赖
 * 输入顺序，而 `Array.prototype.sort` 保证稳定，所以结果是可复现的。加 slug 兜底
 * 会改变「上一篇 / 下一篇」的走向——重构不应该顺手改行为，见 ROADMAP 待办。
 */
export function sortByNewest(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => b.published.localeCompare(a.published));
}

/** 列表按发布日期倒序：newer 为索引更小的一篇，older 为更早的一篇。 */
export function findAdjacent(
  articles: Article[],
  slug: string,
): { newer: Article | null; older: Article | null } {
  const index = articles.findIndex((article) => article.slug === slug);
  if (index === -1) return { newer: null, older: null };
  return {
    newer: index > 0 ? articles[index - 1] : null,
    older: index < articles.length - 1 ? articles[index + 1] : null,
  };
}

/** 标签重叠最多的文章；无重叠时回退为最新的其他文章，避免区块永远为空。
    已在「链接到本文」区块出现过的文章会被排除，防止同一页重复推荐同一篇。 */
export function findRelated(articles: Article[], slug: string, max = 2): Article[] {
  const self = articles.find((article) => article.slug === slug);
  if (!self) return [];

  const linkedFrom = `href="/articles/${slug}"`;
  const others = articles.filter(
    (article) => article.slug !== slug && !article.html.includes(linkedFrom),
  );
  const scored = others
    .map((article) => ({
      article,
      score: article.tags.filter((tag) => self.tags.includes(tag)).length,
    }))
    .sort(
      (a, b) => b.score - a.score || b.article.published.localeCompare(a.article.published),
    );

  const tagged = scored.filter((entry) => entry.score > 0);
  return (tagged.length > 0 ? tagged : scored).slice(0, max).map((entry) => entry.article);
}

export function filterByTag(articles: Article[], tag: string): Article[] {
  return articles.filter((article) => article.tags.includes(tag));
}

/** 全站标签按文章数倒序，同级按名称稳定排序。 */
export function collectTags(articles: Article[]): { tag: string; count: number }[] {
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

/** 反向链接：正文里链接到本文的其他文章，按发布时间倒序。 */
export function findBacklinks(articles: Article[], slug: string): Article[] {
  const linkedFrom = `href="/articles/${slug}"`;
  return sortByNewest(
    articles.filter((article) => article.slug !== slug && article.html.includes(linkedFrom)),
  );
}

/** 同系列文章按发布正序（阅读顺序）；series 不存在时返回空数组。 */
export function findSeries(articles: Article[], series: string | undefined): Article[] {
  if (!series) return [];
  return articles
    .filter((article) => article.series === series)
    .sort((a, b) => a.published.localeCompare(b.published));
}
