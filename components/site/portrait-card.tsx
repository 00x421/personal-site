'use client';

import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { siteIdentity } from '@/lib/site-content';

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
            src="/personal-portrait-scribble.webp"
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
