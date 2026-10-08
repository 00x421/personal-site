'use client';

import { Printer, Rss, Shuffle, Stamp, Sun } from 'lucide-react';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchEntry } from '@/lib/feed-builders';

/**
 * 索引契约的唯一来源是 `lib/feed-builders.ts`——`/search.json` 就是它序列化的结果。
 * 这里过去手抄了一份同形类型，字段一旦增减两处会静默漂移。
 *
 * `import type` 编译期即被擦除，所以不会把服务端代码带进客户端包
 * （这条边界见 HANDOFF「客户端包的边界」）。
 */
type Entry = SearchEntry;

/** /api/search（语义兜底）的结果子集，形状对齐 Entry 以复用渲染。
    meta 与 Entry 对齐但恒为空串——语义命中没有日期可标。 */
type SemanticHit = {
  title: string;
  url: string;
  desc: string;
  type: Entry['type'];
  meta: string;
};

const TYPE_LABEL: Record<Entry['type'], string> = {
  article: '文章',
  project: '项目',
  book: '书架',
};

const MAX_RESULTS = 8;

/**
 * 建议词从已加载的索引实时推导：取文章与项目里出现次数最多的标签。
 *
 * 曾经硬编码为 ['工程手记', 'Cloudflare', '闭环', '提示词']——那是内容还是
 * AI 占位阶段的词。占位内容撤下后，其中三个在当前索引里命中 **0 条**：
 * 访客点一下「闭环」，看到的是「没找到相关的内容」。而且「闭环」「提示词」
 * 本身就是那股 AI 味最重的词。
 *
 * 从索引导出后这件事在结构上不会再发生：一个标签既然出现在某条索引里，
 * 它就必然有命中。文章与项目之外的类型（书架的状态标签）不参与，
 * 把「在读」当搜索词没意义。
 */
const SUGGESTION_COUNT = 4;

function topTags(entries: Entry[]): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type === 'book') continue;
    for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, SUGGESTION_COUNT)
    .map(([tag]) => tag);
}

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

type Command = {
  id: string;
  label: string;
  /** 参与过滤的中英文关键词（含拼音常见拼法） */
  keywords: string;
  icon: typeof Shuffle;
  /** 执行动作；是否关闭面板由动作自己决定（复制 RSS 就不该关）。 */
  run: () => void;
};

/** 全站命令面板：Cmd/Ctrl+K 呼出——搜索 + 命令同一套键盘动线。 */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [semantic, setSemantic] = useState<SemanticHit[] | null>(null);
  const semanticAbortRef = useRef<AbortController | null>(null);
  const [active, setActive] = useState(0);
  const [rssCopied, setRssCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const fetchRef = useRef<Promise<void> | null>(null);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [
      {
        id: 'theme',
        label: '切换明暗主题',
        keywords: 'theme 主题 暗色 亮色 夜间 dark light mode 切换',
        icon: Sun,
        run: () => {
          const root = document.documentElement;
          const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
          root.dataset.theme = next;
          // 与 theme-toggle.tsx 同一条纪律：手动选择即退出自动夜间色温
          delete root.dataset.night;
          try {
            localStorage.setItem('theme', next);
          } catch {
            /* 隐私模式下 localStorage 不可用，静默降级 */
          }
        },
      },
      {
        id: 'album',
        label: '看印谱',
        keywords: 'album 印谱 集邮 印章 章 集齐',
        icon: Stamp,
        run: () => {
          closeDialog();
          window.location.assign('/album');
        },
      },
      {
        id: 'rss',
        label: rssCopied ? 'RSS 地址已复制' : '复制 RSS 订阅地址',
        keywords: 'rss feed 订阅 subscribe 复制',
        icon: Rss,
        run: () => {
          navigator.clipboard
            ?.writeText(`${window.location.origin}/rss.xml`)
            .then(() => {
              setRssCopied(true);
              window.setTimeout(() => setRssCopied(false), 1600);
            })
            .catch(() => {
              /* 剪贴板不可用（非安全上下文等）：提示留在标签上，不再弹错 */
            });
        },
      },
      {
        id: 'print',
        label: '打印本页',
        keywords: 'print 打印 纸 导出',
        icon: Printer,
        run: () => {
          closeDialog();
          // 等面板退场动画走完再唤起系统打印，避免把遮罩印进纸里
          window.setTimeout(() => window.print(), 140);
        },
      },
    ];
    const articles = entries?.filter((entry) => entry.type === 'article') ?? [];
    if (articles.length > 0) {
      list.unshift({
        id: 'random',
        label: '随机读一篇',
        keywords: 'random 随机 随便 抽一篇 惊喜 shuffle 手气',
        icon: Shuffle,
        run: () => {
          const pick = articles[Math.floor(Math.random() * articles.length)];
          closeDialog();
          window.location.assign(pick.url);
        },
      });
    }
    return list;
  }, [entries, rssCopied, closeDialog]);

  const terms = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query],
  );
  const suggestions = useMemo(() => (entries ? topTags(entries) : []), [entries]);
  const matchedCommands = useMemo(() => {
    if (terms.length === 0) return commands;
    return commands.filter((command) => {
      const haystack = `${command.label}${command.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [commands, terms]);
  const results = useMemo(() => {
    if (!entries || terms.length === 0) return [];
    return entries
      .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((item) => item.entry);
  }, [entries, terms]);

  /** 字面零命中时的语义兜底；有字面命中就不掺行——兜底只补空，不抢位。 */
  const combined = results.length > 0 ? results : (semantic ?? []);

  // 兜底查询：防抖 400ms（等用户打完词），中断上一轮，失败静默
  useEffect(() => {
    semanticAbortRef.current?.abort();
    if (terms.length === 0 || results.length > 0 || entries === null || indexError) {
      return;
    }
    const controller = new AbortController();
    semanticAbortRef.current = controller;
    const timer = window.setTimeout(() => {
      fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: query.trim() }),
        signal: controller.signal,
      })
        .then((res) => res.json() as Promise<{ results: SemanticHit[] }>)
        .then((data) => {
          setSemantic(data.results);
        })
        .catch(() => {
          /* 静默：兜底本来就是增强 */
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, terms, results, entries, indexError]);

  /** 命令与结果合成一条键盘动线：↑↓ 走全局序号，Enter 执行当前项。 */
  const total = matchedCommands.length + combined.length;

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
    setSemantic(null);
    setOpen(true);
    ensureIndex();
    dialogRef.current?.showModal();
  }

  function choose(term: string) {
    setQuery(term);
    setActive(0);
    setSemantic(null);
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

  // 过滤条件变化后序号可能越界，收回到有效范围
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(total - 1, 0)));
  }, [total]);

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      // 索引未就绪时列表为空，Math.max 防止 active 被压到 -1
      setActive((i) => Math.min(Math.max(i, 0) + 1, total - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (active < matchedCommands.length) {
        matchedCommands[active]?.run();
      } else {
        itemRefs.current[active]?.click();
      }
    }
  }

  return (
    <>
      {open ? null : (
        <button
          type="button"
          className="search-fab"
          onClick={openDialog}
          aria-label="搜索或执行命令（快捷键 Ctrl K）"
          title="搜索或执行命令（Ctrl K）"
        >
          <Search size={16} aria-hidden="true" />
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="search-modal"
        aria-label="搜索或执行命令"
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
            placeholder="搜索文章、项目、书架，或执行命令…"
            aria-label="搜索关键词或命令"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setSemantic(null);
            }}
            onKeyDown={onInputKey}
          />
          <kbd className="search-esc">ESC</kbd>
          <button
            type="button"
            className="search-close"
            onClick={closeDialog}
            aria-label="关闭"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <ul className="search-list">
          {matchedCommands.length > 0 && (
            <li className="search-group" aria-hidden="true">
              命令
            </li>
          )}
          {matchedCommands.map((command, i) => {
            const Icon = command.icon;
            return (
              <li key={command.id}>
                <button
                  type="button"
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className={`search-item is-cmd${i === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => command.run()}
                >
                  <span className="search-item-type is-cmd">命令</span>
                  <span className="search-item-body">
                    <strong className="search-cmd-label">
                      <Icon size={15} aria-hidden="true" />
                      {command.label}
                    </strong>
                  </span>
                </button>
              </li>
            );
          })}

          {combined.length > 0 && (
            <li className="search-group" aria-hidden="true">
              {results.length > 0 ? '搜索' : '语义相近'}
            </li>
          )}
          {entries === null && !indexError && matchedCommands.length === 0 && (
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
              {suggestions.length > 0 && (
                <p className="search-hint-terms">
                  试试：
                  {suggestions.map((term) => (
                    <button type="button" key={term} onClick={() => choose(term)}>
                      {term}
                    </button>
                  ))}
                </p>
              )}
            </li>
          )}
          {entries !== null &&
            terms.length > 0 &&
            results.length === 0 &&
            semantic === null &&
            matchedCommands.length === 0 && (
              <li className="search-empty">字面没搜到，正在试试语义相近的…</li>
            )}
          {entries !== null &&
            terms.length > 0 &&
            combined.length === 0 &&
            semantic !== null && (
              <li className="search-empty">
                没找到和「{query}」相关的内容。换个词试试？小狗也帮你歪了歪头。
              </li>
            )}
          {combined.map((entry, i) => {
            const index = matchedCommands.length + i;
            return (
              <li key={`${entry.type}-${entry.url}-${entry.title}`}>
                <a
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  href={entry.url}
                  className={`search-item${index === active ? ' is-active' : ''}`}
                  onMouseEnter={() => setActive(index)}
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
            );
          })}
        </ul>

        <div className="search-foot" aria-hidden="true">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 选择
          </span>
          <span>
            <kbd>Enter</kbd> 执行
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
          <span className="search-foot-brand">XWSX</span>
        </div>
      </dialog>
    </>
  );
}
