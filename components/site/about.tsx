import { ArrowUpRight } from 'lucide-react';
import { Reveal } from '@/components/motion';
import { PortraitCard } from '@/components/site/portrait-card';
import { siteConfig } from '@/lib/site-config';

/** 关于区：手绘肖像与自述 */
export function About() {
  return (
    <section id="about" className="about-section section-wrap">
      <Reveal className="portrait-cell">
        <PortraitCard />
      </Reveal>
      <Reveal delay={0.12} className="about-cell">
        <div className="about-copy">
          <span className="section-index">03 /</span>
          <h2>
            我相信好的数字产品，
            <br />
            应该既<strong>聪明</strong>，也<strong>有人味</strong>。
          </h2>
          <p>
            我喜欢拆解模糊的问题：先理解人在什么情境下行动，再用可靠的系统和克制的界面，让每一步都自然发生。
          </p>
          <p>
            这里不仅收录最终产出，也记录问题、取舍与思考。因为真正有价值的工作，通常发生在“看起来简单”之前。
          </p>
          <a href={`mailto:${siteConfig.email}`} className="text-link">
            聊聊一个想法 <ArrowUpRight size={17} />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
