'use client';

import { ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ASK_EVENT } from './select-ask';

/**
 * 首屏的「工程在岗」信号条：小信是否在线来自 /api/ask 的真实探测，
 * 离线就整行不渲染——状态条只说真话，不说气氛话。
 * 「问问小信」直接在首屏打开对话面板（经 nav-buddy 的 xwsx:ask 链路）。
 */
export function HeroStatus() {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/ask')
      .then((res) => res.json() as Promise<{ enabled: boolean }>)
      .then((data) => {
        if (alive) setOnline(Boolean(data.enabled));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function openBuddy() {
    window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: {} }));
  }

  return (
    <div className="hero-status">
      {online && (
        <span className="hero-status-live">
          <i className="status-dot" aria-hidden="true" />
          小信在线
        </span>
      )}
      <button type="button" className="hero-ask" onClick={openBuddy}>
        问问小信 <ArrowUpRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
