'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/site/reveal';
import { projects } from '@/lib/site-content';

const filters = ['全部', '产品设计', '开发实践', '数据产品'] as const;

/** 项目精选：筛选状态与横向滚动需要客户端，整块作为交互孤岛。 */
export function ProjectExplorer() {
  const [active, setActive] = useState('全部');
  const railRef = useRef<HTMLDivElement>(null);
  const visibleProjects =
    active === '全部'
      ? projects
      : projects.filter((project) => project.type === active);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * Math.min(rail.clientWidth * 0.82, 580),
      behavior: 'smooth',
    });
  }

  return (
    <>
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
      <Reveal delay={120}>
        <div className="project-rail-shell">
          <div className="project-rail" ref={railRef} aria-label="项目列表">
            {visibleProjects.map((project) => {
              const card = (
                <article className={`project-card ${project.tone}`}>
                  <div className="project-top">
                    <span>{project.type}</span>
                    <span>{project.year}</span>
                  </div>
                  <div className="project-symbol" aria-hidden="true">
                    <b>{project.mark}</b>
                    <div />
                    <div />
                    <div />
                  </div>
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
              return project.slug ? (
                <Link
                  className="project-link"
                  href={`/projects/${project.slug}`}
                  key={project.title}
                  aria-label={`查看 ${project.title} 案例`}
                >
                  {card}
                </Link>
              ) : (
                <div key={project.title}>{card}</div>
              );
            })}
          </div>
          <div className="project-rail-footer">
            <span>横向浏览更多项目</span>
            <div>
              <button
                type="button"
                onClick={() => scroll(-1)}
                aria-label="查看前面的项目"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => scroll(1)}
                aria-label="查看后面的项目"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </>
  );
}
