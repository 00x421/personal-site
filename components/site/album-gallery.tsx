'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StampSeal } from './stamp-seal';

export type AlbumEntry = { slug: string; title: string; phrase: string };
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

/**
 * 印谱主体：集下的章排成印屏（钤印少有端正的，交替微倾），
 * 未集的是虚位空格——谱的另一半本身就是「还差哪些」的清单。
 * 初始空表与 SSR 一致，挂载后再读 localStorage，避免水合不一致。
 */
export function AlbumGallery({ entries }: { entries: AlbumEntry[] }) {
  const [stamps, setStamps] = useState<Stamps>({});

  useEffect(() => {
    setStamps(readStamps());
  }, []);

  const collected = entries
    .filter((entry) => stamps[entry.slug])
    .sort((a, b) => stamps[b.slug] - stamps[a.slug]);
  const missing = entries.filter((entry) => !stamps[entry.slug]);
  const ordered = [...collected, ...missing];

  return (
    <section className="album-section">
      <p className="album-stats">
        已集 <strong>{collected.length}</strong> / {entries.length} 章
        {collected.length === 0 && (
          <span className="album-empty">——读完任意一篇，那枚章会自己落进来。</span>
        )}
      </p>
      <ul className="album-grid">
        {ordered.map((entry) => {
          const ts = stamps[entry.slug];
          return (
            <li key={entry.slug} className={`album-cell${ts ? ' is-collected' : ''}`}>
              {ts ? (
                <>
                  <StampSeal
                    text={entry.phrase}
                    ariaLabel={`闲章：${entry.phrase}`}
                    size={56}
                  />
                  <Link href={`/articles/${entry.slug}`} className="album-cell-title">
                    {entry.title}
                  </Link>
                  <span className="album-cell-date">盖于 {formatStampDate(ts)}</span>
                </>
              ) : (
                <>
                  <span className="album-cell-blank" aria-hidden="true" />
                  <span className="album-cell-title is-ghost">{entry.title}</span>
                  <span className="album-cell-date is-ghost">未集</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
