import { Code2, Mail } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

/** 页脚 */
export function SiteFooter() {
  return (
    <footer className="site-footer section-wrap">
      <span>
        © {siteConfig.year} {siteConfig.brand} · {siteConfig.brandMotto}
      </span>
      <div>
        <a href={siteConfig.socials.github} target="_blank" rel="noreferrer">
          <Code2 size={16} /> GitHub · {siteConfig.socials.githubUser}
        </a>
        <a href={`mailto:${siteConfig.email}`}>
          <Mail size={16} /> Email
        </a>
      </div>
      <span>Designed with intent</span>
    </footer>
  );
}
