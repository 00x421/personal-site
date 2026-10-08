'use client';

import { useEffect } from 'react';

/**
 * 打印用纸：暗色主题下 Ctrl+P 会把浅色文字印在白纸上（几乎不可读）。
 * beforeprint 时临时切回浅色，afterprint 还原——与主题切换共用
 * <html data-theme> 这一个通道，打印样式表里因此无需重复任何配色变量。
 */
export function PrintTheme() {
  useEffect(() => {
    const root = document.documentElement;
    let saved: string | null = null;

    const beforePrint = () => {
      if (root.dataset.theme === 'dark') {
        saved = 'dark';
        root.dataset.theme = 'light';
      }
    };
    const afterPrint = () => {
      if (saved) {
        root.dataset.theme = saved;
        saved = null;
      }
    };

    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  return null;
}
