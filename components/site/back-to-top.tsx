'use client';

import { ArrowUp } from 'lucide-react';

/**
 * 回到顶部：常驻悬浮（与搜索按钮一致），固定在搜索按钮上方。
 * 点击平滑回顶；处于顶部时点击无副作用。
 */
export function BackToTop() {
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
