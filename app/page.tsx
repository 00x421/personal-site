'use client';

import { ArrowDownRight, ArrowUpRight, Code2, Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { articles } from '@/data/articles';

const projects = [
  { title: 'Flowbase', type: '产品设计', year: '2026', summary: '把零散的客户反馈归纳成可执行的产品决策，让研究从资料库走向下一步行动。', tags: ['研究系统', 'AI 工作流'], tone: 'ink', mark: '01' },
  { title: 'Kite Notes', type: '开发实践', year: '2025', summary: '面向独立创作者的轻量写作工具：更少打断，更快从想法抵达发布。', tags: ['React', '体验设计'], tone: 'violet', mark: '02' },
  { title: 'Atlas Studio', type: '数据产品', year: '2025', summary: '将复杂运营指标沉淀成人人看得懂、每周都能用的增长工作台。', tags: ['数据可视化', '前端工程'], tone: 'lime', mark: '03' },
];
const skills = [
  ['产品与体验', '从问题定义、用户研究到信息架构与交互原型。'],
  ['前端开发', 'React / TypeScript / Next.js，关注细节，也在意长期可维护性。'],
  ['AI 应用', '将 LLM 放进真实的工作流，提升创造力而不是制造噪音。'],
];

export default function Home() {
  const [active, setActive] = useState('全部');
  const visibleProjects = active === '全部' ? projects : projects.filter((project) => project.type === active);
  return <main>
    <nav className="site-nav" aria-label="主导航">
      <a className="brand" href="#top" aria-label="回到顶部">LQ<span>·</span></a>
      <div className="nav-links"><a href="#work">项目</a><a href="#about">关于</a><a href="#stack">技术</a><a href="#writing">文章</a></div>
      <a className="nav-contact" href="mailto:techlocker@163.com">联系我 <ArrowUpRight size={15} /></a>
    </nav>
    <section id="top" className="hero section-wrap">
      <div className="eyebrow"><Sparkles size={14} /> 软件工程师 · 产品构建者 · 2026</div>
      <div className="hero-grid"><h1>把复杂的<br /><em>想法，做得清晰。</em></h1><div className="hero-note"><p>你好，我是 <strong>Linling Qi</strong>，一名喜欢把模糊问题变成可靠产品的程序员。我在设计、代码与 AI 的交界处工作。</p><div className="code-line"><span>const</span> focus = <b>&quot;make it useful&quot;</b>;</div><a href="#work" className="text-link">看看我在做什么 <ArrowDownRight size={17} /></a></div></div>
      <div className="hero-rail" aria-hidden="true"><span>PRODUCT THINKING</span><i /><span>CREATIVE TECHNOLOGY</span><i /><span>HUMAN-CENTERED</span></div>
    </section>
    <section id="work" className="section-wrap work-section">
      <div className="section-head"><div><span className="section-index">01 /</span><h2>精选项目</h2></div><p>一些把洞察、设计与技术连接起来的尝试。</p></div>
      <div className="filters" aria-label="项目筛选">{['全部', '产品设计', '开发实践', '数据产品'].map((filter) => <button key={filter} onClick={() => setActive(filter)} className={active === filter ? 'active' : ''} aria-pressed={active === filter}>{filter}</button>)}</div>
      <div className="project-grid">{visibleProjects.map((project) => <article className={`project-card ${project.tone}`} key={project.title}>
        <div className="project-top"><span>{project.type}</span><span>{project.year}</span></div><div className="project-symbol" aria-hidden="true"><b>{project.mark}</b><div /><div /><div /></div>
        <div className="project-copy"><h3>{project.title}</h3><p>{project.summary}</p></div><div className="project-foot"><div>{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><button aria-label={`查看 ${project.title} 项目`}><ArrowUpRight size={19} /></button></div>
      </article>)}</div>
    </section>
    <section id="writing" className="section-wrap writing-section"><div className="section-head"><div><span className="section-index">02 /</span><h2>技术文章</h2></div><Link href="/articles" className="text-link">查看全部 <ArrowUpRight size={17} /></Link></div><div className="writing-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>{articles.map((article, index) => <a className="writing-card" href={`/articles/${article.slug}`} key={article.slug}><span className="article-number">0{index + 1}</span><div className="article-meta"><span>{article.published}</span><span>{article.readTime}</span></div><h3>{article.title}</h3><p>{article.description}</p><div className="article-tags">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></a>)}</div></section>
    <section id="about" className="about-section section-wrap"><div className="about-copy"><span className="section-index">03 /</span><h2>我相信好的数字产品，<br />应该既<strong>聪明</strong>，也<strong>有人味</strong>。</h2><p>我喜欢拆解模糊的问题：先理解人在什么情境下行动，再用可靠的系统和克制的界面，让每一步都自然发生。</p><p>这里不仅收录最终产出，也记录问题、取舍与思考。因为真正有价值的工作，通常发生在“看起来简单”之前。</p><a href="mailto:techlocker@163.com" className="text-link">聊聊一个想法 <ArrowUpRight size={17} /></a></div><div className="portrait-frame"><div className="portrait-head"><span>LQ / PORTRAIT</span><span>23</span></div><div className="portrait-media">{/* oxlint-disable-next-line no-img-element -- 手绘 PNG 保持原始纸纹质感，不走图片优化管道 */}<img src="/personal-portrait-scribble.jpg" alt="Linling Qi 的手绘程序员肖像" /><div className="portrait-shine" aria-hidden="true" /></div><div className="portrait-foot"><span>CODE / COFFEE / IDEAS</span><span>01—01</span></div></div></section>
    <section id="stack" className="section-wrap stack-section"><div className="section-head"><div><span className="section-index">04 /</span><h2>能力与技术</h2></div><Code2 size={28} strokeWidth={1.5} /></div><div className="skill-list">{skills.map(([name, description], index) => <article key={name}><span>0{index + 1}</span><h3>{name}</h3><p>{description}</p><ArrowUpRight size={20} /></article>)}</div></section>
    <section className="cta section-wrap"><div><span className="eyebrow">有一个值得解决的问题？</span><h2>一起把它<br /><em>变成现实。</em></h2></div><Button nativeButton={false} className="mail-button" render={<a href="mailto:techlocker@163.com" aria-label="发送邮件到 techlocker@163.com" />}><Mail size={17} /> techlocker@163.com <ArrowUpRight size={17} /></Button></section>
    <footer className="site-footer section-wrap"><span>© 2026 Linling Qi</span><div><a href="https://github.com/00x421" target="_blank" rel="noreferrer"><Code2 size={16} /> GitHub · 00x421</a><a href="mailto:techlocker@163.com">Email</a></div><span>Designed with intent</span></footer>
  </main>;
}
