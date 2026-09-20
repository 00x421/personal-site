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
  /** 是否至少有一张卡完全在视野之外。决定要不要显示「横向浏览更多…」。 */
  const [hasHiddenCard, setHasHiddenCard] = useState(false);

  /** 按滚动位置记录两端状态，供 CSS 渐隐遮罩判断哪一侧还有内容。 */
  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setEdges({
      start: rail.scrollLeft <= 4,
      end: max <= 4 || rail.scrollLeft >= max - 4,
    });

    // 提示词该不该出现，判断的是「有没有整张卡看不见」，
    // 而不是「能不能滚」。两者不是一回事：桌面端 1440 下可滚范围只有 112px，
    // 四张卡都至少露出一部分——能滚，但没有「更多文章」可看。
    // 那时提示读起来是空话。所以逐卡判断：任一张的左右边缘都在视野之外才算数。
    const items = Array.from(rail.children) as HTMLElement[];
    if (items.length === 0) {
      setHasHiddenCard(false);
      return;
    }
    const origin = items[0].offsetLeft;
    const viewLeft = rail.scrollLeft;
    const viewRight = viewLeft + rail.clientWidth;
    setHasHiddenCard(
      items.some((item) => {
        const left = item.offsetLeft - origin;
        return left + item.offsetWidth <= viewLeft + 4 || left >= viewRight - 4;
      }),
    );
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
      {/* 提示词只在轨道真的放不下时出现。
          桌面端曾长期显示「横向浏览更多文章」，但那时 4 篇文章几乎全部露在外面
          （可滚范围只有 112px）——提示承诺了体验不到的事，是空话。
          判断依据来自组件已经算出的 scrollWidth - clientWidth，不额外测量。 */}
      <div className="rail-footer">
        {hasHiddenCard && <span>{hint}</span>}
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
