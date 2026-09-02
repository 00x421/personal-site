import { ArrowUpRight, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/motion';
import { siteConfig } from '@/lib/site-config';

/** 联系 CTA 区 */
export function Cta() {
  return (
    <section className="cta section-wrap">
      <Reveal>
        <div>
          <span className="eyebrow">有一个值得解决的问题？</span>
          <h2>
            一起把它
            <br />
            <em>变成现实。</em>
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.15}>
        <Button
          nativeButton={false}
          className="mail-button"
          render={<a href={`mailto:${siteConfig.email}`} aria-label={`发送邮件到 ${siteConfig.email}`} />}
        >
          <Mail size={17} /> {siteConfig.email} <ArrowUpRight size={17} />
        </Button>
      </Reveal>
    </section>
  );
}
