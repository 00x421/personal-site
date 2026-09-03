'use client';

import { useEffect, useRef, useState } from 'react';

/** 文章读完时由小狗回应的联动事件名。 */
export const READ_COMPLETE_EVENT = 'xwsx:read-complete';

/** 文章阅读进度，仅以一条细线反馈当前位置；读到底时广播事件供小狗回应。 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  const celebratedRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollable = root.scrollHeight - root.clientHeight;
      const next =
        scrollable > 0 ? Math.min(100, (root.scrollTop / scrollable) * 100) : 0;
      setProgress(next);
      if (next >= 99.5 && !celebratedRef.current) {
        celebratedRef.current = true;
        window.dispatchEvent(new CustomEvent(READ_COMPLETE_EVENT));
      }
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <progress
      className="reading-progress"
      aria-label="文章阅读进度"
      value={progress}
      max={100}
    />
  );
}
