'use client';

import { ArrowDownRight, ArrowUpRight, Code2, Mail, Moon, Sparkles, Sun } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { PortraitCard } from '@/components/site/portrait-card';
import { Button } from '@/components/ui/button';
import { articles } from '@/data/articles';
import {
  projects,
  siteIdentity,
  siteNavigation,
  skills,
} from '@/lib/site-content';

export default function Home() {
  const [active, setActive] = useState('全部');
  const visibleProjects = active === '全部' ? projects : projects.filter((project) => project.type === active);
  return <main>
    <nav className="site-nav" aria-label="主导航">
      <a className="brand" href="#top" aria-label="回到顶部">{siteIdentity.brand}<span>·</span></a>
      <div className="nav-links">{siteNavigation.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</div>
      <div className="nav-actions"><ThemeToggleButton /><a className="nav-contact" href={`mailto:${siteIdentity.email}`}>联系我 <ArrowUpRight size={15} /></a></div>
    </nav>
    <nav className="mobile-section-nav section-wrap" aria-label="页面目录">{siteNavigation.map(([href, label]) => <a href={href} key={href}>{label}</a>)}</nav>
    <section id="top" className="hero section-wrap">
      <div className="eyebrow"><Sparkles size={14} /> 软件工程师 · 产品构建者 · 2026</div>
      <div className="hero-grid"><h1>把复杂的<em>想法，</em><br /><em>做得清晰。</em></h1><div className="hero-note"><p>你好，我是 <strong>{siteIdentity.name}</strong>。<strong>{siteIdentity.brand}</strong> 是我记录产品、代码与思考的个人空间；我在设计、代码与 AI 的交界处工作。</p><div className="code-line"><span>const</span> motto = <b>&quot;{siteIdentity.motto}&quot;</b>;</div><a href="#work" className="text-link">看看我在做什么 <ArrowDownRight size={17} /></a></div></div>
      <div className="hero-rail" aria-hidden="true"><span>PRODUCT THINKING</span><i /><span>CREATIVE TECHNOLOGY</span><i /><span>HUMAN-CENTERED</span></div>
    </section>
    <section id="work" className="section-wrap work-section">
      <div className="section-head"><div><span className="section-index">01 /</span><h2>精选项目</h2></div><p>一些把洞察、设计与技术连接起来的尝试。</p></div>
      <div className="filters" aria-label="项目筛选">{['全部', '产品设计', '开发实践', '数据产品'].map((filter) => <button key={filter} onClick={() => setActive(filter)} className={active === filter ? 'active' : ''} aria-pressed={active === filter}>{filter}</button>)}</div>
      <div className="project-grid">{visibleProjects.map((project) => <article className={`project-card ${project.tone}`} key={project.title}>
        <div className="project-top"><span>{project.type}</span><span>{project.year}</span></div><div className="project-symbol" aria-hidden="true"><b>{project.mark}</b><div /><div /><div /></div>
        <div className="project-copy"><h3>{project.title}</h3><p>{project.summary}</p></div><div className="project-foot"><div>{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><span className="project-status">{project.status}</span></div>
      </article>)}</div>
    </section>
    <section id="writing" className="section-wrap writing-section"><div className="section-head"><div><span className="section-index">02 /</span><h2>技术文章</h2></div><Link href="/articles" className="text-link">查看全部 <ArrowUpRight size={17} /></Link></div><div className="writing-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>{articles.map((article, index) => <a className="writing-card" href={`/articles/${article.slug}`} key={article.slug}><span className="article-number">0{index + 1}</span><div className="article-meta"><span>{article.published}</span><span>{article.readTime}</span></div><h3>{article.title}</h3><p>{article.description}</p><div className="article-tags">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></a>)}</div></section>
    <section id="about" className="about-section section-wrap"><div className="about-copy"><span className="section-index">03 /</span><h2>我相信好的数字产品，<br />应该既<strong>聪明</strong>，也<strong>有人味</strong>。</h2><p>我喜欢拆解模糊的问题：先理解人在什么情境下行动，再用可靠的系统和克制的界面，让每一步都自然发生。</p><p>这里不仅收录最终产出，也记录问题、取舍与思考。因为真正有价值的工作，通常发生在“看起来简单”之前。</p><a href={`mailto:${siteIdentity.email}`} className="text-link">聊聊一个想法 <ArrowUpRight size={17} /></a></div><PortraitCard /></section>
    <section id="stack" className="section-wrap stack-section"><div className="section-head"><div><span className="section-index">04 /</span><h2>能力与技术</h2></div><Code2 size={28} strokeWidth={1.5} /></div><div className="skill-list">{skills.map(([name, description], index) => <article key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{description}</p><ArrowUpRight size={20} /></article>)}</div></section>
    <section className="cta section-wrap"><div><span className="eyebrow">有一个值得解决的问题？</span><h2>一起把它<br /><em>变成现实。</em></h2></div><Button nativeButton={false} className="mail-button" render={<a href={`mailto:${siteIdentity.email}`} aria-label={`发送邮件到 ${siteIdentity.email}`} />}><Mail size={17} /> {siteIdentity.email} <ArrowUpRight size={17} /></Button></section>
    <footer className="site-footer section-wrap"><span>© 2026 {siteIdentity.brand} · {siteIdentity.motto}</span><div><a href={siteIdentity.github} target="_blank" rel="noreferrer"><Code2 size={16} /> GitHub · 00x421</a><a href={`mailto:${siteIdentity.email}`}>Email</a></div><span>Designed with intent</span></footer>
  </main>;
}

/** 主题切换按钮：无状态实现，读写 <html data-theme> + localStorage，图标显隐交给 CSS */
function ThemeToggleButton() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // 隐私模式下 localStorage 不可用，静默降级
    }
  }
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="切换明暗主题" title="切换明暗主题">
      <Sun size={15} className="theme-icon theme-icon-sun" />
      <Moon size={15} className="theme-icon theme-icon-moon" />
    </button>
  );
}
