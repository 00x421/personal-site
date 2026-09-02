import { ArrowDownRight, Sparkles } from 'lucide-react';
import { Marquee, Reveal, SplitText } from '@/components/motion';
import { siteConfig } from '@/lib/site-config';

const railItems = ['PRODUCT THINKING', 'CREATIVE TECHNOLOGY', 'HUMAN-CENTERED'];

/** Hero 区：标题逐字入场 + 说明浮现 + 无限跑马灯 */
export function Hero() {
  return (
    <section id="top" className="hero section-wrap">
      <div className="eyebrow">
        <Sparkles size={14} /> {siteConfig.role} · {siteConfig.year}
      </div>
      <div className="hero-grid">
        <h1>
          <SplitText text="把复杂的" delay={0.1} />
          <br />
          <em>
            <SplitText text="想法，做得清晰。" delay={0.45} />
          </em>
        </h1>
        <Reveal delay={0.9} y={20} className="hero-note">
          <p>
            你好，我是 <strong>{siteConfig.name}</strong>
            ，一名喜欢把模糊问题变成可靠产品的程序员。我在设计、代码与 AI
            的交界处工作。
          </p>
          <div className="code-line">
            <span>const</span> motto = <b>&quot;{siteConfig.brandMotto}&quot;</b>;
          </div>
          <a href="#work" className="text-link">
            看看我在做什么 <ArrowDownRight size={17} />
          </a>
        </Reveal>
      </div>
      <Marquee className="hero-rail" speed={26}>
        {Array.from({ length: 3 }).map((_, round) => (
          <span className="rail-group" key={round}>
            {railItems.map((item) => (
              <span key={item}>
                {item}
                <i />
              </span>
            ))}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
