'use client';

import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Entry = {
  type: 'article' | 'project' | 'book';
  title: string;
  desc: string;
  tags: string[];
  url: string;
  meta: string;
  /** 服务端已小写化的全文匹配文本。 */
  text: string;
};

const TYPE_LABEL: Record<Entry['type'], string> = {
  article: '文章',
  project: '项目',
  book: '书架',
};

const MAX_RESULTS = 8;
const SUGGESTIONS = ['工程手记', 'Cloudflare', '闭环', '提示词'];

function escapeRe(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 多关键词 AND 匹配：任一词未命中即淘汰；标题 > 标签 > 摘要 > 全文加权。 */
function scoreEntry(entry: Entry, terms: string[]) {
  const title = entry.title.toLowerCase();
  const desc = entry.desc.toLowerCase();
  let total = 0;
  for (const term of terms) {
    let score = 0;
    if (title.includes(term)) score += 6;
    if (entry.tags.some((tag) => tag.toLowerCase().includes(term))) score += 4;
    if (desc.includes(term)) score += 2;
    if (entry.text.includes(term)) score += 1;
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) {
    return <>{text}</>;
  }
  // 捕获组 split：奇数索引即命中片段
  const parts = text.split(new RegExp(`(${terms.map(escapeRe).join('|')})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** 全站搜索：右下角入口 + Cmd/Ctrl+K，索引来自 /search.json（首次打开时懒加载）。 */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const fetchRef = useRef<Promise<void> | null>(null);

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const results = useMemo(() => {
    if (!entries || terms.length === 0) return [];
    return entries
      .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((item) => item.entry);
  }, [entries, terms]);

  const ensureIndex = useCallback(() => {
    if (fetchRef.current) return;
    const load = fetch('/search.json')
      .then((res) => res.json() as Promise<Entry[]>)
      .then((data) => {
        setEntries(data);
        setIndexError(false);
      });
    fetchRef.current = load;
    load.catch(() => {
      fetchRef.current = null; // 失败后允许重试
      setIndexError(true);
    });
  }, []);

  function openDialog() {
    setActive(0);
    setQuery('');
    setOpen(true);
    ensureIndex();
    dialogRef.current?.showModal();
  }

  function choose(term: string) {
    setQuery(term);
    setActive(0);
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialogRef.current?.open) {
          dialogRef.current.close();
        } else {
          openDialog();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!open) return;
    ensureIndex();
    inputRef.current?.select();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, ensureIndex]);

  useEffect(() => {
    if (open) itemRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      // 索引未就绪时 results 为空，Math.max 防止 active 被压到 -1
      setActive((i) => Math.min(Math.max(i, 0) + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      itemRefs.current[active]?.click();
    }
  }

  return (
    <>
      {open ? null : (
        <button
          type="button"
          className="search-fab"
          onClick={openDialog}
          aria-label="搜索本站（快捷键 Ctrl K）"
          title="搜索本站（Ctrl K）"
        >
          <Search size={16} aria-hidden="true" />
          <span className="search-fab-kbd" aria-hidden="true">
            ⌘K
          </span>
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="search-modal"
        aria-label="搜索本站"
        onClose={() => setOpen(false)}
        onKeyDown={(event) => {
          // 原生 Esc 走 cancel→close；此处兜底个别环境下合成/被拦的 Escape
          if (event.key === 'Escape') closeDialog();
        }}
      >
        <div className="search-input-row">
          <Search size={16} className="search-input-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            value={query}
            placeholder="搜索文章、项目、书架…"
            aria-label="搜索关键词"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
          />
          <kbd className="search-esc">ESC</kbd>
          <button
            type="button"
            className="search-close"
            onClick={closeDialog}
            aria-label="关闭搜索"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <ul className="search-list">
          {entries === null && !indexError && (
            <li className="search-empty">正在准备索引…</li>
          )}
          {entries === null && indexError && (
            <li className="search-empty">
              索引加载失败，网络恢复后可以重试。
              <button type="button" className="search-retry" onClick={ensureIndex}>
                重试
              </button>
            </li>
          )}
          {entries !== null && terms.length === 0 && (
            <li className="search-hint">
              <p>输入关键词，搜索全站的文章、项目与书架。</p>
              <p className="search-hint-terms">
                试试：
                {SUGGESTIONS.map((term) => (
                  <button type="button" key={term} onClick={() => choose(term)}>
                    {term}
                  </button>
                ))}
              </p>
            </li>
          )}
          {entries !== null && terms.length > 0 && results.length === 0 && (
            <li className="search-empty">
              没找到和「{query}」相关的内容。换个词试试？小狗也帮你歪了歪头。
            </li>
          )}
          {results.map((entry, i) => (
            <li key={`${entry.type}-${entry.url}-${entry.title}`}>
              <a
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                href={entry.url}
                className={`search-item${i === active ? ' is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={closeDialog}
              >
                <span className={`search-item-type is-${entry.type}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
                <span className="search-item-body">
                  <strong>
                    <Highlight text={entry.title} terms={terms} />
                  </strong>
                  {entry.desc ? (
                    <span className="search-item-desc">
                      <Highlight text={entry.desc} terms={terms} />
                    </span>
                  ) : null}
                </span>
                <span className="search-item-meta">{entry.meta}</span>
              </a>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
