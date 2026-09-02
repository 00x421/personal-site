'use client';

import { Moon, Sun } from 'lucide-react';

/**
 * 主题切换按钮：无状态实现。
 * 点击时直接读写 <html data-theme> 并写入 localStorage,
 * 太阳/月亮图标的显隐交给 CSS（跟随 data-theme），无 effect、无 hydration 风险。
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // 隐私模式下 localStorage 可能不可用，静默降级
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label="切换明暗主题"
      title="切换明暗主题"
    >
      <Sun size={15} className="theme-icon theme-icon-sun" />
      <Moon size={15} className="theme-icon theme-icon-moon" />
    </button>
  );
}
