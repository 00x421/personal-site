'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** 非安全上下文（如局域网 IP 访问）无 navigator.clipboard 时的回退。 */
function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      // eslint-disable-next-line no-deprecated
      const ok = document.execCommand('copy');
      if (ok) resolve();
      else reject(new Error('copy failed'));
    } catch (error) {
      reject(error);
    } finally {
      textarea.remove();
    }
  });
}

/**
 * 正文 HTML 由 marked 在服务端渲染，无法组件化。
 * 这里在客户端把 pre 包进 .code-block，并注入语言标签与复制按钮；路由切换后对新出现的块重跑。
 */
export function CodeBlockEnhancer({ scope }: { scope: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector(scope);
    if (!root) return;
    root.querySelectorAll('pre[data-lang]').forEach((pre) => {
      if (pre.parentElement?.classList.contains('code-block')) return;
      const lang = pre.getAttribute('data-lang') ?? 'text';

      const langEl = document.createElement('span');
      langEl.textContent = lang;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy';
      button.textContent = '复制';
      button.addEventListener('click', () => {
        copyText(pre.querySelector('code')?.textContent ?? '')
          .then(() => {
            button.textContent = '已复制 ✓';
            button.setAttribute('data-copied', '');
            window.setTimeout(() => {
              button.textContent = '复制';
              button.removeAttribute('data-copied');
            }, 1600);
          })
          .catch(() => {});
      });

      const head = document.createElement('div');
      head.className = 'code-block-head';
      head.appendChild(langEl);
      head.appendChild(button);

      const wrap = document.createElement('div');
      wrap.className = 'code-block';
      pre.replaceWith(wrap);
      wrap.appendChild(head);
      wrap.appendChild(pre);
    });
  }, [pathname, scope]);

  return null;
}
