'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { TiltedCard } from '@/components/motion';

/**
 * 手绘肖像卡片：
 * - TiltedCard 提供悬停微倾斜
 * - 图片随页面滚动产生轻微视差
 * - 悬停时光泽扫过（CSS .portrait-shine）
 */
export function PortraitCard() {
  const mediaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: mediaRef,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['-5%', '5%']);

  return (
    <TiltedCard maxTilt={4.5} scale={1.02} className="portrait-frame">
      <div className="portrait-head">
        <span>XWSX · PORTRAIT</span>
        <span>01—01</span>
      </div>
      <div className="portrait-media" ref={mediaRef}>
        <motion.img
          src="/portrait.jpg"
          alt="Linling Qi 的手绘肖像"
          loading="lazy"
          style={{ y, scale: 1.12 }}
        />
        <span className="portrait-shine" aria-hidden="true" />
      </div>
      <div className="portrait-foot">
        <span>HAND-DRAWN</span>
        <span>信我所行</span>
      </div>
    </TiltedCard>
  );
}
