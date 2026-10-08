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
  // 集齐成就：新发一篇文章会多出一个空位，成就随之收回——谱是活的。
  const complete = entries.length > 0 && missing.length === 0;

  return (
    <section className="album-section">
      <p className="album-stats">
        已集 <strong>{collected.length}</strong> / {entries.length} 章
        {collected.length === 0 && (
          <span className="album-empty">——读完任意一篇，那枚章会自己落进来。</span>
        )}
      </p>
      {complete && (
        <div className="album-master">
          {/* 篆刻传统里印分两类：闲章言志，名章识人。闲章集满，
              落一枚站名正章——方正的边框区别于闲章的圆角。 */}
          <StampSeal
            text="信我所行"
            ariaLabel="名章：信我所行——印谱集满的落款"
            size={76}
          />
          <div className="album-master-text">
            <strong>印谱已满</strong>
            <span>
              {entries.length} 篇读遍。闲章言志，名章识人——
              这一枚是站名正章，谢你陪我走完全部。
            </span>
          </div>
        </div>
      )}
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
