'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  formatStampDate,
  getEmptyStampsSnapshot,
  getStampsSnapshot,
  subscribeStamps,
  writeStamp,
} from './read-stamps';
import { StampSeal } from './stamp-seal';
import { pickPhrase } from '@/lib/seal-phrases';
import { READ_COMPLETE_EVENT } from './reading-progress';

/**
 * 文末朱印区：纸墨站点的「读完仪式」。
 *
 * - 「已读」章平时隐藏；读者读完全文（READ_COMPLETE_EVENT）时以三阶段
 *   动画盖下，并写入 localStorage 集邮；再访时以淡印显示上次阅读日期。
 * - 闲章不固定：按 slug 从闲章池里稳定选一句（同一篇永远同一句，
 *   不同篇各不相同）——书签式，每一枚都可以收藏。纯本地，无追踪。
 * - 集下的章都收在 /album 印谱；集过至少一枚后，在这里给出入口。
 *
 * 集章记录走 useSyncExternalStore（见 read-stamps.ts）：服务端与首帧
 * 渲染空谱，水合后换成真值，SSR 输出不会因为读不到 localStorage 而漂移。
 */

export function ArticleSeal({ slug }: { slug: string }) {
  const [stamped, setStamped] = useState(false);
  const stamps = useSyncExternalStore(
    subscribeStamps,
    getStampsSnapshot,
    getEmptyStampsSnapshot,
  );
  const previous = stamps[slug] ?? null;
  const albumCount = Object.keys(stamps).length;
  const phrase = pickPhrase(slug);

  // 读完 → 记一枚章。setState 只发生在事件回调里，不在 effect 体内。
  useEffect(() => {
    const celebrate = () => {
      try {
        writeStamp(slug, Date.now());
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
      {albumCount > 0 && (
        <Link href="/album" className="article-seal-album-link">
          印谱 · 已集 {albumCount} 章
        </Link>
      )}
    </div>
  );
}
