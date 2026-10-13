'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/site/reveal';
import { MOCK_CARDS } from './mock-cards';

/**
 * 卡片需要的字段。
 *
 * 这里**不能** import `@/data/projects`：那个模块用 eager 的
 * `import.meta.glob('?raw')` 把全部 Markdown 原文内联进模块，一旦被客户端组件
 * 引用，访客为了看筛选栏就要下载 marked、prismjs 和所有案例全文
 * （实测 84 KB 解压 / 34 KB 传输）。现在字段由服务端以 props 传入，
 * 类型定义留在本文件，客户端不再触碰数据层。
 */
type ProjectCard = {
  slug: string;
  title: string;
  type: string;
  year: string;
  summary: string;
  tags: string[];
  tone: 'ink' | 'violet' | 'lime';
  mark: string;
  cover?: string | null;
  status: string;
  hasCase: boolean;
};

export type { ProjectCard };

type Props = {
  cards: ProjectCard[];
  filters: string[];
};

/** 按页大小切块：一页 = 展台一屏（桌面 4 张 / 窄屏 2 张）。 */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

/** 项目精选：筛选 + 翻页都需要客户端，整块作为交互孤岛。
 *
 * 卡牌展台：区块高度恒定（一行 4 张，窄屏 2 张），多出来的卡靠
 * 「翻页」看——track 按页横移（旋转门），箭头禁用态明确页尾；
 * 筛选变化即回第一页。曾经这里先是横向轨道（2 个项目时是空承诺）、
 * 后是竖版网格长列表（把整页拉长），最终定版为定高展台。
 *
 * 倾斜与光泽靠 CSS 变量（--rx/--ry/--px/--py），指针事件只写变量，
 * 不引 tilt 库；触屏与 prefers-reduced-motion 一次判定后静态呈现。 */
export function ProjectExplorer({ cards, filters }: Props) {
  const [active, setActive] = useState('全部');
  /** 预览模式：/?mock=1 时注入虚拟卡，观察规模效果（仅站主使用） */
  const [mockMode, setMockMode] = useState(false);
  const [perPage, setPerPage] = useState(4);
  const [page, setPage] = useState(0);
  /** null = 还没判定过；惰性缓存，指针高频事件里不做重复的 matchMedia */
  const staticMode = useRef<boolean | null>(null);

  useEffect(() => {
    setMockMode(new URLSearchParams(window.location.search).has('mock'));
  }, []);

  // 每页张数随断点（4 ↔ 2），断点变化时回到第一页
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const update = () => {
      setPerPage(mq.matches ? 2 : 4);
      setPage(0);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const pool = mockMode ? [...cards, ...MOCK_CARDS] : cards;
  // 预览模式下筛选维度从虚拟卡实时推导（服务端传来的 filters 不含虚拟类型）
  const effectiveFilters = mockMode
    ? ['全部', ...Array.from(new Set(pool.map((card) => card.type)))]
    : filters;

  const visibleProjects =
    active === '全部' ? pool : pool.filter((project) => project.type === active);
  const pages = chunk(visibleProjects, perPage);
  const safePage = Math.min(page, Math.max(pages.length - 1, 0));

  function onFilter(filter: string) {
    setActive(filter);
    setPage(0);
  }

  function tiltVars(event: React.PointerEvent<HTMLElement>) {
    staticMode.current ??=
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (staticMode.current) return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const py = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    el.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
    el.style.setProperty('--px', `${px * 100}`);
    el.style.setProperty('--py', `${py * 100}`);
  }

  function tiltReset(event: React.PointerEvent<HTMLElement>) {
    if (staticMode.current) return;
    const el = event.currentTarget;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--px', '50');
    el.style.setProperty('--py', '50');
  }

  return (
    <>
      {/* 只有一种类型时「全部」与它结果完全相同，整行隐藏 */}
      {effectiveFilters.length > 2 && (
        <Reveal delay={60}>
          <div className="filters" aria-label="项目筛选">
            {effectiveFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => onFilter(filter)}
                className={active === filter ? 'active' : ''}
                aria-pressed={active === filter}
              >
                {filter}
              </button>
            ))}
          </div>
        </Reveal>
      )}
      <Reveal delay={120}>
        <div className="deck-shell">
          <div
            className="deck-track"
            style={{ transform: `translateX(-${safePage * 100}%)` }}
          >
            {pages.map((chunkCards, pageIndex) => (
              <ul
                className="project-rail is-tcg"
                key={pageIndex}
                inert={pageIndex !== safePage || undefined}
              >
                {chunkCards.map((project, index) => {
                  const num = pageIndex * perPage + index + 1;
                  const card = (
                    <article
                      className={`project-card tcg ${project.tone}`}
                      onPointerMove={tiltVars}
                      onPointerLeave={tiltReset}
                    >
                      <div className="tcg-inner">
                        <header className="tcg-head">
                          <span>{project.type}</span>
                          <span>{project.year}</span>
                        </header>
                        <div className="tcg-art">
                          {project.cover ? (
                            // oxlint-disable-next-line next/no-img-element -- 卡面封面，本地静态资源
                            <img
                              className="tcg-cover"
                              src={project.cover}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span className="tcg-mark" data-mark={project.mark} />
                          )}
                        </div>
                        <div className="tcg-copy">
                          <h3>{project.title}</h3>
                          <p>{project.summary}</p>
                        </div>
                        <footer className="tcg-foot">
                          <div className="tcg-tags">
                            {project.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                          <div className="tcg-meta">
                            <span className="tcg-status">{project.status}</span>
                            <span className="tcg-num">
                              No.{String(num).padStart(3, '0')}
                            </span>
                          </div>
                        </footer>
                      </div>
                    </article>
                  );
                  return (
                    <li key={project.slug}>
                      {project.hasCase ? (
                        <Link
                          className="project-link"
                          href={`/projects/${project.slug}`}
                        >
                          {card}
                        </Link>
                      ) : (
                        card
                      )}
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        </div>
        {pages.length > 1 && (
          <div className="rail-footer deck-controls">
            <span>
              第 {safePage + 1} / {pages.length} 页 · 共 {visibleProjects.length} 张
            </span>
            <div>
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                aria-label="上一页"
              >
                <ArrowLeft size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pages.length - 1}
                aria-label="下一页"
              >
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </Reveal>
    </>
  );
}
