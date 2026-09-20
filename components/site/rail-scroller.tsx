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

  /** 窗口尺寸变化后校正到最近的卡片起点。
   *
   *  卡片宽度是视口相关的（`38vw` / 窄屏 `82vw`），所以 resize 之后旧的
   *  `scrollLeft`（一个像素值）很可能落在两张卡之间，需要重新对齐。
   *
   *  ⚠️ **只在 resize 时做，不要挂到 scroll 上。** 这段逻辑曾经监听 `scroll`，
   *  在停止滚动 220ms 后校正——结果是**任何一次手动拖拽都会被拉回最近的卡片
   *  起点**，而且因为它是延迟触发 + `smooth` 动画，看起来完全像「轨道自己弹
   *  回去了」（用户报的就是这个）。实测把 `scrollLeft` 设到卡片中间 438px，
   *  900ms 后自己被改成 334px。
   *
   *  现在「停在两张卡之间」是合法状态（轨道用 `proximity` 而非 `mandatory`），
   *  所以拖拽后不该再有任何自动校正。 */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let timer = 0;
    const settle = () => {
      const items = Array.from(rail.children) as HTMLElement[];
      if (items.length === 0) return;
      // 卡片的 snap 位置 = 自身 offsetLeft 相对首卡的偏移
      // （首卡 offsetLeft 即轨道左内边距，两者相减就得到内容坐标）
      const origin = items[0].offsetLeft;
      const current = rail.scrollLeft;
      let nearestDist = Infinity;
      let nearestLeft = current;
      for (const item of items) {
        const dist = Math.abs(item.offsetLeft - origin - current);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestLeft = item.offsetLeft - origin;
        }
      }
      if (nearestDist > 4) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        rail.scrollTo({ left: nearestLeft, behavior: reduced ? 'auto' : 'smooth' });
      }
    };
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 220);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(timer);
    };
  }, []);

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
      <div className="rail-footer">
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
