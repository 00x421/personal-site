'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/site/reveal';

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
  /** 卡面封面图（public 下的路径）；缺省回退到 mark 水印 */
  cover?: string | null;
  status: string;
  hasCase: boolean;
};

type Props = {
  cards: ProjectCard[];
  filters: string[];
};

/** 项目精选：筛选状态需要客户端，整块作为交互孤岛。
 *
 * 曾经这里还有一套横向轨道（scrollBy + 两端渐隐）——项目只有 2 个时
 * scrollWidth 等于容器宽，滚动按钮从不生效，底下的「横向浏览更多项目」
 * 是个空承诺。改成纵向列表后那整套逻辑连同 ref / 事件监听一起删了。
 *
 * 卡牌化（63:88 竖版 TCG 比例）：倾斜与光泽全靠 CSS 变量（--rx/--ry/
 * --px/--py），指针事件只负责写变量——不引 tilt 库，才能和站内滚动
 * 打架最小化。触屏与 prefers-reduced-motion 一次判定后静态呈现。 */
export function ProjectExplorer({ cards, filters }: Props) {
  const [active, setActive] = useState('全部');
  /** null = 还没判定过；惰性缓存，指针高频事件里不做重复的 matchMedia */
  const staticMode = useRef<boolean | null>(null);

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

  const visibleProjects =
    active === '全部' ? cards : cards.filter((project) => project.type === active);

  return (
    <>
      {/* 只有一种类型时「全部」与它结果完全相同，整行隐藏 */}
      {filters.length > 2 && (
        <Reveal delay={60}>
          <div className="filters" aria-label="项目筛选">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActive(filter)}
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
        <ul className="project-rail is-tcg">
          {visibleProjects.map((project, index) => {
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
                        No.{String(index + 1).padStart(3, '0')}
                      </span>
                    </div>
                  </footer>
                </div>
              </article>
            );
            return (
              <li key={project.slug}>
                {project.hasCase ? (
                  <Link className="project-link" href={`/projects/${project.slug}`}>
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      </Reveal>
    </>
  );
}
