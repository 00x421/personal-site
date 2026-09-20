'use client';

import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { siteIdentity } from '@/lib/site-content';

/**
 * 响应式候选集。母版是 1024×1536，所以 1024 是上限，不再上采样。
 * 由 scripts/optimize-portrait.py 生成（`npm run portrait`）。
 *
 * 为什么要一组而不是一个文件：原来只有单一 768×1152，而实测显示尺寸是
 *   视口 390  → 319×432（DPR3 需要 956px）
 *   视口 1024 → 323×576（DPR3 需要 969px）
 *   视口 1440 → 420×576（DPR3 需要 1259px）
 * 同一个文件对谁都不同时合适：低倍屏浪费流量，高倍屏又不够用。
 */
const PORTRAIT_SRCSET = [320, 480, 640, 800, 1024]
  .map((w) => `/personal-portrait-scribble-${w}.webp ${w}w`)
  .join(', ');

/**
 * 与 .about-section 的实际布局对齐（1.15fr / 0.85fr，gap 12vw，内容宽上限 1280）：
 *   ≤720px  单栏，肖像占满内容宽 → 100vw - 64px（40 内边距 + 24 相框）
 *   721-1280 双栏，肖像列 ≈ 0.374 × 100vw - 53px
 *   >1280   内容宽封顶，肖像 ≈ 430px（gap 仍随 vw 增长，所以不再变宽）
 * 实测校验：768→225、1024→323、1440→420，均在声明值之内。
 */
const PORTRAIT_SIZES =
  '(max-width: 720px) calc(100vw - 64px), (max-width: 1280px) calc(37.4vw - 53px), 430px';

/** 手绘肖像：以小幅指针视差模拟纸张层叠的景深。 */
export function PortraitCard() {
  const cardRef = useRef<HTMLDivElement>(null);

  function resetDepth() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--portrait-rotate-x', '0deg');
    card.style.setProperty('--portrait-rotate-y', '0deg');
  }

  function updateDepth(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    const card = cardRef.current;
    if (!card) return;

    const bounds = card.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
    const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;

    card.style.setProperty('--portrait-rotate-x', `${vertical * -4}deg`);
    card.style.setProperty('--portrait-rotate-y', `${horizontal * 4}deg`);
  }

  return (
    <div className="portrait-depth">
      <div
        className="portrait-frame"
        ref={cardRef}
        onPointerMove={updateDepth}
        onPointerLeave={resetDepth}
      >
        <div className="portrait-head">
          <span>{siteIdentity.brand} / PORTRAIT</span>
          <span>23</span>
        </div>
        <div className="portrait-media">
          {/* oxlint-disable-next-line next/no-img-element -- 保留原始纸纹质感。 */}
          <img
            src="/personal-portrait-scribble-640.webp"
            srcSet={PORTRAIT_SRCSET}
            sizes={PORTRAIT_SIZES}
            width={1024}
            height={1536}
            /* 这张图在所有视口下都在首屏之外（它在 about 区，hero 之下），
               所以不该进关键路径。它曾经是被 preload 的，和真正的 LCP 元素
               （导航栏的小狗图）抢带宽。延迟加载后首次渲染不再请求它。 */
            loading="lazy"
            decoding="async"
            alt={`${siteIdentity.name} 的手绘程序员肖像`}
          />
        </div>
        <div className="portrait-foot">
          <span>CODE / COFFEE / IDEAS</span>
          <span>01—01</span>
        </div>
      </div>
    </div>
  );
}
