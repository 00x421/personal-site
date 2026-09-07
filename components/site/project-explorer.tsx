'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/site/reveal';
import { projectFilters, projects } from '@/data/projects';

/** 项目精选：筛选状态与横向滚动需要客户端，整块作为交互孤岛。 */
export function ProjectExplorer() {
  const [active, setActive] = useState('全部');
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const visibleProjects =
    active === '全部'
      ? projects
      : projects.filter((project) => project.type === active);

  /** 按滚动位置记录两端状态，供 CSS 渐隐遮罩判断哪一侧还有内容。 */
  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    setEdges({
      start: rail.scrollLeft <= 4,
      end: max <= 4 || rail.scrollLeft >= max - 4,
    });
  }, []);

  // 筛选切换会改变轨道宽度，渲染完成后重新同步。
  useEffect(() => {
    syncEdges();
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener('scroll', syncEdges, { passive: true });
    window.addEventListener('resize', syncEdges);
    return () => {
      rail.removeEventListener('scroll', syncEdges);
      window.removeEventListener('resize', syncEdges);
    };
  }, [syncEdges, active]);

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
          {projectFilters.map((filter) => (
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
        <div
          className="project-rail-shell"
          data-at-start={edges.start || undefined}
          data-at-end={edges.end || undefined}
        >
          <div className="project-rail" ref={railRef} aria-label="项目列表">
            {visibleProjects.map((project) => {
              const card = (
                <article className={`project-card ${project.tone}`}>
                  <div className="project-top">
                    <span>{project.type}</span>
                    <span>{project.year}</span>
                  </div>
                  <div className="project-symbol" aria-hidden="true" data-mark={project.mark}>
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
              return project.hasCase ? (
                <Link
                  className="project-link"
                  href={`/projects/${project.slug}`}
                  key={project.slug}
                >
                  {card}
                </Link>
              ) : (
                <div key={project.slug}>{card}</div>
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
