import { ArrowUpRight, Code2 } from 'lucide-react';
import { NumberTicker, Reveal } from '@/components/motion';
import { homeSkills } from '@/data/home';

/** 能力与技术区：序号滚动 + 滚动入场 */
export function Stack() {
  return (
    <section id="stack" className="section-wrap stack-section">
      <Reveal>
        <div className="section-head">
          <div>
            <span className="section-index">04 /</span>
            <h2>能力与技术</h2>
          </div>
          <Code2 size={28} strokeWidth={1.5} />
        </div>
      </Reveal>
      <div className="skill-list">
        {homeSkills.map(([name, description], index) => (
          <Reveal key={name} delay={index * 0.08}>
            <article>
              <NumberTicker value={index + 1} />
              <h3>{name}</h3>
              <p>{description}</p>
              <ArrowUpRight size={20} />
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
