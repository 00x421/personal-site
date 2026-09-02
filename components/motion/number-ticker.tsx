'use client';

import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useRef } from 'react';

type NumberTickerProps = {
  value: number;
  className?: string;
  /** 进入视口后的启动延迟（秒） */
  delay?: number;
  /** 滚动时长（秒） */
  duration?: number;
  /** 前导零位数，默认 2 位（01、02…） */
  padStart?: number;
};

/**
 * 数字滚动（参考 React Bits Number Ticker 模式）：
 * 进入视口后从 0 滚动到目标值，用于序号等场景。
 */
export function NumberTicker({
  value,
  className,
  delay = 0,
  duration = 1.4,
  padStart = 2,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    if (!isInView) return;
    const timer = setTimeout(() => motionValue.set(value), delay * 1000);
    return () => clearTimeout(timer);
  }, [isInView, motionValue, value, delay]);

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          ref.current.textContent = String(Math.round(latest)).padStart(padStart, '0');
        }
      }),
    [springValue, padStart],
  );

  return (
    <span ref={ref} className={className}>
      {String(0).padStart(padStart, '0')}
    </span>
  );
}
