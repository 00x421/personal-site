import { ArrowUpRight } from 'lucide-react';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { siteConfig } from '@/lib/site-config';

/** 顶部导航 */
export function SiteHeader() {
  return (
    <nav className="site-nav" aria-label="主导航">
      <a className="brand" href="#top" aria-label="回到顶部">
        {siteConfig.brand}
        <span>·</span>
      </a>
      <div className="nav-links">
        <a href="#work">项目</a>
        <a href="#about">关于</a>
        <a href="#stack">技术</a>
        <a href="#writing">文章</a>
      </div>
      <div className="nav-actions">
        <ThemeToggle />
        <a className="nav-contact" href={`mailto:${siteConfig.email}`}>
          联系我 <ArrowUpRight size={15} />
        </a>
      </div>
    </nav>
  );
}
