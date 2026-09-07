'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type RailScrollerProps = {
  label: string;
  hint: string;
  /** 滚动按钮 aria-label 用的名词，如「项目」「文章」。 */
  itemNoun: string;
  children: ReactNode;
};

/** 横向内容轨道：静态内容由服务端渲染经 children 传入，这里只负责滚动按钮。 */
export function RailScroller({ label, hint, itemNoun, children }: RailScrollerProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  /** 按滚动位置记录两端状态，供 CSS 渐隐遮罩判断哪一侧还有内容。 */
  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setEdges({
      start: rail.scrollLeft <= 4,
      end: max <= 4 || rail.scrollLeft >= max - 4,
    });
  }, []);

  useEffect(() => {
    syncEdges();
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener('scroll', syncEdges, { passive: true });
    window.addEventListener('resize', syncEdges);
    return () => {
      rail.removeEventListener('scroll', syncEdges);
      window.removeEventListener('resize', syncEdges);
    };
  }, [syncEdges]);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.min(rail.clientWidth * 0.82, 580),
      behavior: 'smooth',
    });
  }

  return (
    <div
      className="writing-rail-shell"
      data-at-start={edges.start || undefined}
      data-at-end={edges.end || undefined}
    >
      <div className="writing-rail" ref={railRef} aria-label={label}>
        {children}
      </div>
      <div className="project-rail-footer">
        <span>{hint}</span>
        <div>
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`查看前面的${itemNoun}`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`查看后面的${itemNoun}`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
