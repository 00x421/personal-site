'use client';

import { motion } from 'motion/react';

type SplitTextProps = {
  text: string;
  className?: string;
  /** 整段文字的起始延迟（秒） */
  delay?: number;
  /** 相邻字符之间的间隔（秒） */
  stagger?: number;
};

/**
 * 逐字入场文本（参考 React Bits Split Text 模式）：
 * 每个字符从下方带轻微旋转浮现。支持中文。
 */
export function SplitText({ text, className, delay = 0, stagger = 0.05 }: SplitTextProps) {
  const characters = Array.from(text);
  return (
    <span className={className} aria-label={text}>
      {characters.map((char, index) => (
        <motion.span
          key={`${index}-${char}`}
          aria-hidden="true"
          style={{ display: 'inline-block', willChange: 'transform, opacity' }}
          initial={{ opacity: 0, y: '0.6em', rotate: 5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{
            duration: 0.6,
            delay: delay + index * stagger,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
}
