'use client';

import { useEffect, useState } from 'react';
import { StampSeal } from './stamp-seal';
import { READ_COMPLETE_EVENT } from './reading-progress';

/**
 * 文末朱印区：纸墨站点的「读完仪式」。
 *
 * - 「已读」章平时隐藏；读者读完全文（READ_COMPLETE_EVENT）时以三阶段
 *   动画盖下，并写入 localStorage 集邮；再访时以淡印显示上次阅读日期。
 * - 闲章不固定：按 slug 从闲章池里稳定选一句（同一篇永远同一句，
 *   不同篇各不相同）——书签式，每一枚都可以收藏。纯本地，无追踪。
 */

type Stamps = Record<string, number>;

/** 闲章池：四字短语，篆刻闲章「图像内的声音」传统——一句自我的心声。 */
const SEAL_PHRASES = [
  '信我所行',
  '知行合一',
  '日拱一卒',
  '事上磨炼',
  '温故知新',
  '格物致知',
  '宁静致远',
  '澄怀观道',
  '慢即是快',
  '把事做透',
] as const;

/** slug 短哈希 → 池内索引。确定性映射：无 SSR 水合不一致，再访不换句。 */
function pickPhrase(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return SEAL_PHRASES[hash % SEAL_PHRASES.length];
}

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
  const phrase = pickPhrase(slug);

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
          text={phrase}
          ariaLabel={`闲章：${phrase}`}
          muted={!stamped}
          size={64}
        />
      </div>
      {!stamped && previous && (
        <p className="article-seal-note is-quiet">
          你曾在 {formatStampDate(previous)} 读到过这里。
        </p>
      )}
    </div>
  );
}
