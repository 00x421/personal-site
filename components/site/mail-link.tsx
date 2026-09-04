'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文（http 预览等）走 execCommand 回退
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      // 渐进增强：clipboard API 在非安全上下文不可用时的唯一回退手段
      // oxlint-disable-next-line no-deprecated
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * mailto 链接 + 剪贴板兜底：访客若没有本地邮件客户端（网页邮箱用户），
 * 点击后邮箱已进剪贴板并给出「已复制」反馈，不会静默无响应。
 * 复制失败时保持原生 mailto 行为，不打扰。
 */
export function MailLink({
  email,
  copiedText = '邮箱已复制',
  children,
  ...anchorProps
}: {
  email: string;
  copiedText?: string;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const onClick = useCallback(() => {
    void copyText(email).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 2200);
    });
  }, [email]);

  return (
    <a data-copied={copied} href={`mailto:${email}`} onClick={onClick} {...anchorProps}>
      {copied ? copiedText : children}
    </a>
  );
}
