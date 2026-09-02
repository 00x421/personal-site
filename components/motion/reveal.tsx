'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  /** 延迟（秒），用于同屏多元素的错峰入场 */
  delay?: number;
  /** 入场位移距离（px），向上浮现 */
  y?: number;
  /** 是否只播放一次 */
  once?: boolean;
  className?: string;
};

/**
 * 滚动入场容器：进入视口时向上浮现并淡入。
 * 用于各内容区块的统一入场动画。
 */
export function Reveal({ children, delay = 0, y = 28, once = true, className }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
