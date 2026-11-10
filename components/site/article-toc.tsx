'use client';

import { useEffect, useState } from 'react';
import type { TocEntry } from '@/lib/markdown';

/**
 * 长文阅读目录。
 *
 * 桌面在侧栏 sticky 常驻并随滚动高亮当前小节（IntersectionObserver，
 * 依赖 heading id 由构建期注入）；移动端用 <details> 折叠（无 JS 也可用）。
 *
 * 两端的 DOM 位置不同，所以拆成两个组件：
 * - `ArticleTocRail` 在 `<header>` 之前，宽屏浮动到标题右侧；
 * - `ArticleTocMobile` 在标题块末尾，窄屏先看到标题、再看到目录。
 * 各自持有一份滚动高亮（两个实例观察到的是同一批标题，互不影响）。
 */

const HEAD_OFFSET = 76; // 顶栏高度 + 呼吸位，锚点跳转的 scroll-margin 与之同步

/** 滚动高亮：视口上部最近的小节标题为当前节。 */
function useActiveHeading(entries: TocEntry[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    let latest = '';
    const observer = new IntersectionObserver(
      (visible) => {
        for (const entry of visible) {
          if (entry.isIntersecting) latest = entry.target.id;
        }
        if (latest) setActiveId(latest);
      },
      // 触发带置顶偏移：顶栏遮挡区之下的第一个标题算「当前」
      { rootMargin: `-${HEAD_OFFSET}px 0px -70% 0px` },
    );
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  return activeId;
}

function TocList({
  entries,
  activeId,
}: {
  entries: TocEntry[];
  activeId: string | null;
}) {
  return (
    <ol className="article-toc-list">
      {entries.map((entry) => (
        <li key={entry.id} data-depth={entry.depth}>
          <a
            href={`#${entry.id}`}
            className={activeId === entry.id ? 'is-active' : undefined}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** 桌面侧栏：≥1280 才显示，浮动在标题右侧。 */
export function ArticleTocRail({ entries }: { entries: TocEntry[] }) {
  const activeId = useActiveHeading(entries);
  if (entries.length === 0) return null;
  return (
    <aside className="article-toc" aria-label="本篇目录">
      <span className="section-index">TOC / 目录</span>
      <TocList entries={entries} activeId={activeId} />
    </aside>
  );
}

/** 移动端折叠目录：放在标题块末尾、正文之前。 */
export function ArticleTocMobile({ entries }: { entries: TocEntry[] }) {
  const activeId = useActiveHeading(entries);
  if (entries.length === 0) return null;
  return (
    <details className="article-toc-mobile">
      <summary>目录</summary>
      <TocList entries={entries} activeId={activeId} />
    </details>
  );
}
