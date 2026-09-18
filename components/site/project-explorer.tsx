'use client';

import { useState } from 'react';
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
export type ProjectCard = {
  slug: string;
  title: string;
  type: string;
  year: string;
  summary: string;
  tags: string[];
  tone: 'ink' | 'violet' | 'lime';
  mark: string;
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
 * 是个空承诺。改成纵向列表后那整套逻辑连同 ref / 事件监听一起删了。 */
export function ProjectExplorer({ cards, filters }: Props) {
  const [active, setActive] = useState('全部');
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
        <ul className="project-rail">
          {visibleProjects.map((project) => {
            const card = (
              <article className={`project-card ${project.tone}`}>
                <div className="project-top">
                  <span>{project.type}</span>
                  <span>{project.year}</span>
                </div>
                <div className="project-symbol" aria-hidden="true" data-mark={project.mark} />
                <div className="project-copy">
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                </div>
                <div className="project-foot">
                  <div>
                    {project.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <span className="project-status">{project.status}</span>
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
