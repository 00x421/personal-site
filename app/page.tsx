import {
  ArrowDownRight,
  ArrowUpRight,
  Code2,
  Mail,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Fragment } from 'react';
import { MailLink } from '@/components/site/mail-link';
import { NavBuddy } from '@/components/site/nav-buddy';
import { PortraitCard } from '@/components/site/portrait-card';
import { ProjectExplorer } from '@/components/site/project-explorer';
import { RailScroller } from '@/components/site/rail-scroller';
import { Reveal } from '@/components/site/reveal';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { articles } from '@/data/articles';
import { siteIdentity, siteNavigation, skills } from '@/lib/site-content';

/** hero 标签带关键词；渲染两份供移动端无缝滚动使用 */
const heroTags = [
  'PRODUCT THINKING',
  'SYSTEMS THINKING',
  'CREATIVE TECHNOLOGY',
  'HUMAN-CENTERED',
  'RPA',
  'AI AGENT',
  'AI WORKFLOW',
  'AUTOMATION',
];

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="主导航">
        <div className="nav-brand-group">
          <a className="brand" href="#top">
            {siteIdentity.brand}
            <span>·</span>
          </a>
          <NavBuddy />
        </div>
        <div className="nav-links">
          {siteNavigation.map(([href, label]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <MailLink className="nav-contact" email={siteIdentity.email}>
            联系我 <ArrowUpRight size={15} />
          </MailLink>
        </div>
      </nav>
      <nav className="mobile-section-nav section-wrap" aria-label="页面目录">
        {siteNavigation.map(([href, label]) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>
      <section id="top" className="hero section-wrap">
        <div className="eyebrow">
          <Sparkles size={14} /> 软件工程师 · 产品构建者 · 2026
        </div>
        <div className="hero-grid">
          <h1>
            <span className="h1-line">
              把复杂的<em>想法，</em>
            </span>
            <span className="h1-line">
              <em>做得清晰。</em>
            </span>
          </h1>
          <div className="hero-note">
            <p>
              你好，我是 <strong>{siteIdentity.name}</strong>。
              <strong>{siteIdentity.brand}</strong>{' '}
              是我记录产品、代码与思考的个人空间；我在设计、代码与 AI
              的交界处工作。
            </p>
            <div className="code-line">
              <span>const</span> motto = <b>&quot;{siteIdentity.motto}&quot;</b>
              ;
            </div>
            <a href="#work" className="text-link">
              看看我在做什么 <ArrowDownRight size={17} />
            </a>
          </div>
        </div>
        <div className="hero-rail" aria-hidden="true">
          <div className="hero-rail-track">
            {[0, 1].map((copy) => (
              <div className="hero-rail-group" key={copy}>
                {heroTags.map((tag) => (
                  <Fragment key={tag}>
                    <span>{tag}</span>
                    <i />
                  </Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
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
        <ProjectExplorer />
      </section>
      <section id="writing" className="section-wrap writing-section">
        <Reveal>
          <div className="section-head">
            <div>
              <span className="section-index">02 /</span>
              <h2>技术文章</h2>
            </div>
            <Link href="/articles" className="text-link">
              查看全部 <ArrowUpRight size={17} />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <RailScroller
            label="技术文章列表"
            hint="横向浏览更多文章"
            itemNoun="文章"
          >
            {articles.map((article, index) => (
              <a
                className="writing-card"
                href={`/articles/${article.slug}`}
                key={article.slug}
              >
                <span className="article-number">0{index + 1}</span>
                <div className="article-meta">
                  <span>{article.published}</span>
                  <span>{article.readTime}</span>
                </div>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <div className="article-tags">
                  {article.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </a>
            ))}
          </RailScroller>
        </Reveal>
      </section>
      <section id="about" className="about-section section-wrap">
        <Reveal className="about-copy">
          <div className="section-head">
            <div>
              <span className="section-index">03 /</span>
              <h2>关于</h2>
            </div>
          </div>
          <p className="about-statement">
            我相信好的数字产品，
            <br />
            应该既<strong>聪明</strong>，也<strong>有人味</strong>。
          </p>
          <p>
            我喜欢拆解模糊的问题：先理解人在什么情境下行动，再用可靠的系统和克制的界面，让每一步都自然发生。
          </p>
          <p>
            这里不仅收录最终产出，也记录问题、取舍与思考。因为真正有价值的工作，通常发生在“看起来简单”之前。
          </p>
          <MailLink className="text-link" email={siteIdentity.email}>
            聊聊一个想法 <ArrowUpRight size={17} />
          </MailLink>
        </Reveal>
        <Reveal className="portrait-reveal" delay={100}>
          <PortraitCard />
        </Reveal>
      </section>
      <section id="stack" className="section-wrap stack-section">
        <Reveal>
          <div className="section-head">
            <div>
              <span className="section-index">04 /</span>
              <h2>能力与技术</h2>
            </div>
            <p>支撑项目从想法到落地的基本功。</p>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="skill-list">
            {skills.map(([name, description], index) => (
              <article key={name}>
                <span>0{index + 1}</span>
                <h3>{name}</h3>
                <p>{description}</p>
                <ArrowUpRight size={20} />
              </article>
            ))}
          </div>
        </Reveal>
      </section>
      <section className="cta section-wrap">
        <div>
          <span className="eyebrow">有一个值得解决的问题？</span>
          <h2>
            一起把它
            <br />
            <em>变成现实。</em>
          </h2>
        </div>
        <MailLink
          className="mail-button"
          email={siteIdentity.email}
          copiedText="已复制"
          aria-label={`发送邮件到 ${siteIdentity.email}，点击同时复制邮箱`}
        >
          <Mail size={17} /> {siteIdentity.email} <ArrowUpRight size={17} />
        </MailLink>
      </section>
      <footer className="site-footer section-wrap">
        <span>
          © 2026 {siteIdentity.brand} · {siteIdentity.motto}
        </span>
        <div>
          <Link href="/now">现在</Link>
          <Link href="/books">书架</Link>
          <a href={siteIdentity.github} target="_blank" rel="noreferrer">
            <Code2 size={16} /> GitHub · 00x421
          </a>
          <MailLink email={siteIdentity.email} copiedText="已复制">
            Email
          </MailLink>
        </div>
        <span>Designed with intent</span>
      </footer>
    </main>
  );
}
