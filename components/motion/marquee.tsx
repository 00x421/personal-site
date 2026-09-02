'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type MarqueeProps = {
  children: ReactNode;
  /** 单轮滚动时长（秒），越小越快 */
  speed?: number;
  className?: string;
};

/**
 * 无限跑马灯：内容复制两份并水平循环滚动。
 * 容器需配合 CSS 限制宽度与溢出隐藏。
 */
export function Marquee({ children, speed = 24, className }: MarqueeProps) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={`marquee ${className ?? ''}`} aria-hidden="true">
      <motion.div
        className="marquee-track"
        animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
        transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}
