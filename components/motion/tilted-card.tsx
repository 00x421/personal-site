'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

type TiltedCardProps = {
  children: ReactNode;
  className?: string;
  /** 最大倾斜角度（度） */
  maxTilt?: number;
  /** hover 放大倍数 */
  scale?: number;
};

/**
 * 3D 倾斜卡片（参考 React Bits Tilted Card 模式）：
 * 指针位置驱动 rotateX/rotateY，弹簧回弹，离开时复位。
 */
export function TiltedCard({ children, className, maxTilt = 7, scale = 1.015 }: TiltedCardProps) {
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const spring = { stiffness: 200, damping: 22, mass: 0.5 };
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [maxTilt, -maxTilt]), spring);
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-maxTilt, maxTilt]), spring);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width);
    pointerY.set((event.clientY - bounds.top) / bounds.height);
  }

  function handlePointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
      whileHover={{ scale }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </motion.div>
  );
}
