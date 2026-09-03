'use client';

import { useEffect, useState } from 'react';

/** 文章阅读进度，仅以一条细线反馈当前位置。 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollable = root.scrollHeight - root.clientHeight;
      setProgress(
        scrollable > 0 ? Math.min(100, (root.scrollTop / scrollable) * 100) : 0,
      );
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
