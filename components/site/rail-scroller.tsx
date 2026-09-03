'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
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

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.min(rail.clientWidth * 0.82, 580),
      behavior: 'smooth',
    });
  }

  return (
    <div className="writing-rail-shell">
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
