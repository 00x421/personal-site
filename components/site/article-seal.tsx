'use client';

import { useEffect, useState } from 'react';
import { StampSeal } from './stamp-seal';
import { READ_COMPLETE_EVENT } from './reading-progress';
import { siteIdentity } from '@/lib/site-content';

/**
 * 文末朱印区：纸墨站点的「读完仪式」。
 *
 * - 闲章「信我所行」常驻——文人画传统里闲章是作品落款的一部分，不是装饰。
 * - 「已读」章平时隐藏；读者读完全文（READ_COMPLETE_EVENT）时以三阶段
 *   动画盖下，并写入 localStorage 集邮；再访时以淡印显示上次阅读日期。
 * - 集邮记录纯本地（无后端、无追踪），key: xwsx-read-stamps。
 */

type Stamps = Record<string, number>;

function readStamps(): Stamps {
  try {
    return JSON.parse(localStorage.getItem('xwsx-read-stamps') ?? '{}') as Stamps;
  } catch {
    return {};
  }
}

function formatStampDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function ArticleSeal({ slug }: { slug: string }) {
  const [stamped, setStamped] = useState(false);
  const [previous, setPrevious] = useState<number | null>(null);

  useEffect(() => {
    const stamps = readStamps();
    const last = stamps[slug];
    if (last) setPrevious(last);

    const celebrate = () => {
      const now = Date.now();
      try {
        const current = readStamps();
        current[slug] = now;
        localStorage.setItem('xwsx-read-stamps', JSON.stringify(current));
      } catch {
        /* localStorage 不可用时仪式照常，只是不存档 */
      }
      setStamped(true);
    };
    window.addEventListener(READ_COMPLETE_EVENT, celebrate);
    return () => window.removeEventListener(READ_COMPLETE_EVENT, celebrate);
  }, [slug]);

  return (
    <div className="article-seal-zone" data-stamped={stamped || undefined}>
      <div className="article-seal-row">
        {stamped && (
          <StampSeal text="已读" ariaLabel="已读完本篇" entering size={64} />
        )}
        <StampSeal
          text="信我所行"
          ariaLabel={`闲章：${siteIdentity.motto}`}
          muted={!stamped}
          size={76}
        />
      </div>
      {stamped && (
        <p className="article-seal-note">朱印已落，这篇是你的了。</p>
      )}
      {!stamped && previous && (
        <p className="article-seal-note is-quiet">
          你曾在 {formatStampDate(previous)} 读到过这里。
        </p>
      )}
    </div>
  );
}
