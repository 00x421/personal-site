'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Type } from 'lucide-react';
import type { TocEntry } from '@/lib/markdown';

/**
 * 长文阅读工具：目录（TOC）+ 字号三档。
 *
 * 目录：桌面在侧栏 sticky 常驻并随滚动高亮当前小节（IntersectionObserver，
 * 依赖 heading id 由构建期注入）；移动端用 <details> 折叠（无 JS 也可用，
 * 交互惯例与站内搜索的渐进增强一致）。
 * 字号：三档写入 localStorage（xwsx-article-font），挂在 .article-detail
 * 的 data-font-scale 属性上，CSS 变量按档缩放正文。
 */

const SCALES = ['s', 'm', 'l'] as const;
const STORAGE_KEY = 'xwsx-article-font';
const HEAD_OFFSET = 76; // 顶栏高度 + 呼吸位，锚点跳转的 scroll-margin 与之同步

export function ArticleToc({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scale, setScale] = useState<'s' | 'm' | 'l'>('m');
  const hydratedRef = useRef(false);

  // 字号档恢复：读 localStorage 后才挂属性（避免 SSR 水合不一致）
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const value = SCALES.includes((saved ?? '') as 's' | 'm' | 'l')
      ? (saved as 's' | 'm' | 'l')
      : 'm';
    setScale(value);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const detail = document.querySelector('.article-detail');
    if (detail) detail.setAttribute('data-font-scale', scale);
    localStorage.setItem(STORAGE_KEY, scale);
  }, [scale]);

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

  function cycleScale(direction: 1 | -1) {
    setScale((current) => {
      const index = SCALES.indexOf(current);
      return SCALES[Math.min(SCALES.length - 1, Math.max(0, index + direction))];
    });
  }

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

  const tools = (
    <div className="article-reading-tools">
      <span className="article-reading-tools-label">
        <Type size={13} aria-hidden="true" /> 字号
      </span>
      <div className="article-font-controls" role="group" aria-label="正文字号">
        <button
          type="button"
          onClick={() => cycleScale(-1)}
          disabled={scale === 's'}
          aria-label="调小字号"
        >
          <Minus size={13} aria-hidden="true" />
        </button>
        <span aria-live="polite">{scale === 's' ? '小' : scale === 'm' ? '中' : '大'}</span>
        <button
          type="button"
          onClick={() => cycleScale(1)}
          disabled={scale === 'l'}
          aria-label="调大字号"
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  if (entries.length === 0) return null;

  return (
    <>
      {/* 桌面侧栏 */}
      <aside className="article-toc" aria-label="本篇目录">
        <span className="section-index">TOC / 目录</span>
        {tocList}
        {tools}
      </aside>
      {/* 移动端折叠：无 JS 也可展开 */}
      <details className="article-toc-mobile">
        <summary>
          <Type size={13} aria-hidden="true" /> 目录与字号
        </summary>
        {tocList}
        {tools}
      </details>
    </>
  );
}
