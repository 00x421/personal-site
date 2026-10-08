'use client';

import { Moon, Sun } from 'lucide-react';

/** 主题切换按钮：无状态实现，读写 <html data-theme> + localStorage，图标显隐交给 CSS */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    // 手动选择即退出自动模式：夜间色温微调只对「从未手动选择」的访客生效
    delete root.dataset.night;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // 隐私模式下 localStorage 不可用，静默降级
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
