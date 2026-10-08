'use client';

import { useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * 回到顶部：滚过半屏才出现——停在页首时「回顶」没有意义，常驻反而占地方。
 *
 * 滚动状态写在 <html data-scrolled> 上而不是组件 state：回到首页按钮要据此
 * 让位/补位（见 globals.css 的 .back-to-home），跨组件状态走 DOM 属性最省事
 * （与主题系统的 data-theme 同一套路）。rAF 节流，滚动本身零重渲染。
 */
export function BackToTop() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      root.setAttribute(
        'data-scrolled',
        window.scrollY > window.innerHeight * 0.5 ? '1' : '0',
      );
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="回到顶部"
      title="回到顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <ArrowUp size={17} aria-hidden="true" />
    </button>
  );
}
