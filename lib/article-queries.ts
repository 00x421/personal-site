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
 * 按发布日期倒序（新的在前），**同日按 slug 升序**。
 *
 * 第二个排序键是 2026-09-23 加上的。在那之前同日文章完全依赖输入顺序：
 * 因为 `Array.prototype.sort` 稳定，结果仍可复现，但输入顺序一变（换构建
 * 工具、改 glob 模式）排版就会静默重排。
 *
 * 当时的顾虑是“会改变上一篇 / 下一篇的走向”，实测**没有发生**：本站 4 篇
 * 文章的现有顺序恰好就是 slug 升序，所以这次是零可见代价的修复。
 */
export function sortByNewest(articles: Article[]): Article[] {
  return [...articles].sort(
    (a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug),
  );
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

/** 全站标签按文章数倒序，同级按名称稳定排序。
    同一篇文章里的重复标签只计一次（用 Set 收敛，见 lib/content-parse.ts 的 unique）。 */
export function collectTags(articles: Article[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    for (const tag of new Set(article.tags)) {
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

/** 同系列文章按发布正序（阅读顺序），同日按 slug 升序；series 不存在时返回空数组。

    第二个排序键的理由与 sortByNewest 相同，而这里更要紧：本站「工程手记」
    三篇**全部同一天发布**，所以在此之前系列阅读顺序实际由输入顺序决定。 */
export function findSeries(articles: Article[], series: string | undefined): Article[] {
  if (!series) return [];
  return articles
    .filter((article) => article.series === series)
    .sort(
      (a, b) => a.published.localeCompare(b.published) || a.slug.localeCompare(b.slug),
    );
}
