'use client';

import { useEffect, useState } from 'react';
import type { TocEntry } from '@/lib/markdown';

/**
 * 长文阅读目录。
 *
 * 桌面在侧栏 sticky 常驻并随滚动高亮当前小节（IntersectionObserver，
 * 依赖 heading id 由构建期注入）；移动端用 <details> 折叠（无 JS 也可用）。
 */

const HEAD_OFFSET = 76; // 顶栏高度 + 呼吸位，锚点跳转的 scroll-margin 与之同步

export function ArticleToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // 滚动高亮：观察全部小节标题，视口上部最近的一个为当前节
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

  if (entries.length === 0) return null;

  const tocList = (
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

  return (
    <>
      {/* 桌面侧栏 */}
      <aside className="article-toc" aria-label="本篇目录">
        <span className="section-index">TOC / 目录</span>
        {tocList}
      </aside>
      {/* 移动端折叠：无 JS 也可展开 */}
      <details className="article-toc-mobile">
        <summary>目录</summary>
        {tocList}
      </details>
    </>
  );
}
