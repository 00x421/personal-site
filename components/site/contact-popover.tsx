'use client';

import { ArrowUpRight, Mail, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { siteIdentity } from '@/lib/site-content';

/**
 * 「联系我」弹出面板：关注公众号 / 邮箱，两条路并列。
 * 收起惯例同站内搜索与小信气泡：点面板外或 Esc。
 *
 * 公众号目前以「微信搜索」指路（未认证号拿不到网页端二维码接口）；
 * 站主把账号二维码放进 public/wechat-qr.png 后，此处可直接补 <img>。
 */
export function ContactPopover() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function copyEmail() {
    navigator.clipboard
      ?.writeText(siteIdentity.email)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        /* 剪贴板不可用（非安全上下文等）：静默，文字本身就是邮箱 */
      });
  }

  return (
    <span className="contact-wrap" ref={wrapRef}>
      <button
        type="button"
        className="nav-contact"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        联系我 <ArrowUpRight size={15} />
      </button>
      {open && (
        <div className="contact-pop" role="dialog" aria-label="联系方式">
          <div className="contact-pop-row">
            <MessageCircle size={16} aria-hidden="true" />
            <div>
              <strong>关注公众号</strong>
              <p>
                微信搜索「<b>技术快递柜</b>」，发消息直达站长。
              </p>
            </div>
          </div>
          <div className="contact-pop-row">
            <Mail size={16} aria-hidden="true" />
            <div>
              <strong>邮箱</strong>
              <p>
                <button type="button" className="contact-email" onClick={copyEmail}>
                  {copied ? '已复制 ✓' : siteIdentity.email}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
