'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** 在区块第一次进入视口时轻微显现；减少动态效果偏好下保持静态。 */
export function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;

    node.dataset.revealReady = 'true';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        node.dataset.revealVisible = 'true';
        observer.unobserve(node);
      },
      { threshold: 0.12 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
