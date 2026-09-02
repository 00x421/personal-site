'use client';

import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Reveal, TiltedCard } from '@/components/motion';
import { homeProjects } from '@/data/home';

const filters = ['全部', '产品设计', '开发实践', '数据产品'];

/** 精选项目区：分类筛选 + 卡片 3D 倾斜 */
export function Projects() {
  const [active, setActive] = useState('全部');
  const visibleProjects =
    active === '全部' ? homeProjects : homeProjects.filter((project) => project.type === active);

  return (
    <section id="work" className="section-wrap work-section">
      <Reveal>
        <div className="section-head">
          <div>
            <span className="section-index">01 /</span>
            <h2>精选项目</h2>
          </div>
          <p>一些把洞察、设计与技术连接起来的尝试。</p>
        </div>
      </Reveal>
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
      <div className="project-grid">
        {visibleProjects.map((project) => (
          <TiltedCard key={project.title} className="project-cell">
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
                <button aria-label={`查看 ${project.title} 项目`}>
                  <ArrowUpRight size={19} />
                </button>
              </div>
            </article>
          </TiltedCard>
        ))}
      </div>
    </section>
  );
}
