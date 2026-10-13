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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** 项目精选：筛选 + 3D 翻页展台，整块作为交互孤岛。
 *
 * 交互模型（检测鼠标左右移动/互动就触发翻）：
 * 1. 悬停预倾——指针在展台左右边缘 15% 区域时，整排卡牌朝翻页方向
 *    微微旋转（像书页被掀起一角），离开即弹回；
 * 2. 拖拽跟手——按住横向拖，卡牌实时绕 Y 轴转动跟手，越过页宽 12%
 *    松手即翻过去，不足则弹回；
 * 3. 箭头/点击——同一路径，翻页时当前页与目标页绕各自纵轴旋转交割。
 * 实现是一帧函数 applyFrame(pageFloat, dragPx)：输入「当前所处页位的
 * 浮点值」，输出整排卡牌的 rotateY/scale/opacity——拖拽、悬停、翻页
 * 三种输入都汇到它上面，动画交给 CSS transition。
 * 触屏可横向拖（touch-action: pan-y 保留纵向滚动）；
 * prefers-reduced-motion 下全部 3D 关闭，只做瞬时翻页。 */
export function ProjectExplorer({ cards, filters }: Props) {
  const [active, setActive] = useState('全部');
  /** 预览模式：/?mock=1 时注入虚拟卡，观察规模效果（仅站主使用） */
  const [mockMode, setMockMode] = useState(false);
  const [perPage, setPerPage] = useState(4);
  const [page, setPage] = useState(0);
  /** 动效可用性：reduced-motion 关闭全部 3D，翻页瞬时完成 */
  const [motionOK, setMotionOK] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    dx: number;
    /** 按下的若是链接卡，原地点击（未拖动）时手动补一次跳转 */
    linkEl: HTMLAnchorElement | null;
  } | null>(null);
  const suppressClick = useRef(false);
  /** null = 还没判定过；惰性缓存，指针高频事件里不做重复的 matchMedia */
  const staticMode = useRef<boolean | null>(null);

  useEffect(() => {
    setMockMode(new URLSearchParams(window.location.search).has('mock'));
    setMotionOK(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

  /** 一帧渲染：pageFloat（含拖拽偏移的当前页位）决定整排卡牌的 3D 姿态。
      位移必须用像素而不是百分比——track 的百分比基准是它自身宽度，
      分数页位混算会反向飞出（频闪的根源）。 */
  function applyFrame(pageFloat: number, dragPx: number) {
    const shell = shellRef.current;
    if (!shell) return;
    const width = shell.clientWidth || 1;
    const track = shell.querySelector<HTMLElement>('.deck-track');
    if (track) {
      track.style.transform = `translate3d(${pageFloat * -width + dragPx}px, 0, 0)`;
    }
    shell.querySelectorAll<HTMLElement>('.project-rail.is-tcg').forEach((pageEl, i) => {
      const d = clamp(i - pageFloat, -1.6, 1.6);
      const ry = clamp(-d * 24, -32, 32);
      const scale = 1 - Math.min(Math.abs(d) * 0.1, 0.18);
      pageEl.style.transform = `rotateY(${ry}deg) scale(${scale})`;
      pageEl.style.opacity = `${1 - Math.min(Math.abs(d) * 0.5, 0.7)}`;
    });
  }

  // 页位变化 → 从当前姿态动画翻到新页（拖拽松手/箭头/键盘同路径）
  useEffect(() => {
    if (motionOK) applyFrame(safePage, 0);
  }, [safePage, perPage, motionOK, pages.length]);

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

  /** 悬停预倾：指针在左右边缘 15% 区域且该方向可翻时，掀起书页一角；
      其余位置轻微跟随鼠标；移出展台弹回。 */
  function edgePeek(event: React.PointerEvent) {
    if (!motionOK || dragRef.current) return;
    const shell = shellRef.current;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    let ry = 0;
    let tx = 0;
    if (x > 0.85 && safePage < pages.length - 1) {
      ry = -9;
      tx = -26;
    } else if (x < 0.15 && safePage > 0) {
      ry = 9;
      tx = 26;
    } else {
      ry = (x - 0.5) * -4;
    }
    shell.style.transform = `rotateY(${ry}deg) translateX(${tx}px)`;
  }

  function onShellPointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) {
      edgePeek(event);
      return;
    }
    drag.dx = event.clientX - drag.startX;
    const width = shellRef.current?.clientWidth || 1;
    const ratio = drag.dx / width;
    const atEdge =
      (safePage === 0 && drag.dx > 0) || (safePage >= pages.length - 1 && drag.dx < 0);
    // 越过第一页/最后一页的拖拽加阻尼：拖得动但费劲，暗示到头了
    if (atEdge) {
      applyFrame(safePage - ratio * 0.25, drag.dx * 0.25);
    } else {
      applyFrame(safePage - ratio, drag.dx);
    }
  }

  function onShellPointerDown(event: React.PointerEvent) {
    if (!motionOK) return;
    // 箭头按钮有自己的点击语义；链接卡允许拖（跳转见 PointerUp 的手动补发）
    if ((event.target as HTMLElement).closest('button')) return;
    // 关键：清掉「边缘预倾」的倾斜——否则在最左/最右卡上按下时，
    // 整排还带着 9° 预倾被拖动，观感就是「这张卡拉不动」
    if (shellRef.current) shellRef.current.style.transform = '';
    event.preventDefault(); // 防文字选中与原生图片拖拽
    const linkEl = (event.target as HTMLElement).closest('a');
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      dx: 0,
      linkEl: linkEl ?? null,
    };
    shellRef.current?.setPointerCapture(event.pointerId);
    shellRef.current?.classList.add('is-dragging');
  }

  function onShellPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    shellRef.current?.classList.remove('is-dragging');
    const width = shellRef.current?.clientWidth || 1;
    const ratio = drag.dx / width;
    const moved = Math.abs(drag.dx) > 6;
    if (ratio > 0.12 && safePage > 0) {
      setPage(safePage - 1);
    } else if (ratio < -0.12 && safePage < pages.length - 1) {
      setPage(safePage + 1);
    } else {
      applyFrame(safePage, 0); // 不够阈值：弹回当前页
    }
    if (moved) {
      // 拖拽松手的 click 是余波，拦掉，防止误触卡面链接
      suppressClick.current = true;
    } else if (drag.linkEl) {
      // 指针被 capture 到展台后，原链接收不到 click——未拖动就手动补发
      drag.linkEl.click();
    }
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
        <div className="deck-zone">
          <div
            className="deck-shell"
            ref={shellRef}
            onPointerMove={onShellPointerMove}
            onPointerDown={onShellPointerDown}
            onPointerUp={onShellPointerUp}
            onPointerLeave={() => {
              if (shellRef.current) shellRef.current.style.transform = '';
            }}
            onClickCapture={(event) => {
              // 拖拽松手后的那次 click 是拖拽的余波，不该触发卡面链接
              if (suppressClick.current) {
                event.preventDefault();
                event.stopPropagation();
                suppressClick.current = false;
              }
            }}
          >
          <div
            className="deck-track"
            style={
              motionOK
                ? undefined
                : { transform: `translateX(-${safePage * 100}%)` }
            }
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
            <>
              <button
                type="button"
                className="deck-arrow deck-arrow-prev"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                aria-label="上一页"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="deck-arrow deck-arrow-next"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pages.length - 1}
                aria-label="下一页"
              >
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {pages.length > 1 && (
          <div className="rail-footer deck-controls">
            <span>
              第 {safePage + 1} / {pages.length} 页 · 共 {visibleProjects.length} 张
            </span>
          </div>
        )}
      </Reveal>
    </>
  );
}
