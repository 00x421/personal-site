import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Reveal, SplitText } from '@/components/motion';
import { articles } from '@/data/articles';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `技术文章 — ${siteConfig.brand}`,
  description: '关于产品思考、前端工程、AI 应用与可访问性的技术文章。',
  alternates: { canonical: '/articles' },
};

export default function ArticlesPage() {
  return (
    <main className="article-page">
      <div className="article-shell">
        <Link href="/#top" className="back-link">
          <ArrowLeft size={15} /> 返回首页
        </Link>
        <header className="article-index-head">
          <span className="section-index">WRITING / 2026</span>
          <h1>
            <SplitText text="把实践写下来，" />
            <br />
            <em>
              <SplitText text="让思考可复用。" delay={0.35} />
            </em>
          </h1>
          <Reveal delay={0.7}>
            <p>这里记录我在产品、前端工程与 AI 应用中的实验、判断和复盘。</p>
          </Reveal>
        </header>
        <div className="article-list">
          {articles.map((article, index) => (
            <Reveal key={article.slug} delay={index * 0.08}>
              <Link className="article-row" href={`/articles/${article.slug}`}>
                <span className="article-number">0{index + 1}</span>
                <div>
                  <div className="article-meta">
                    <span>{article.published}</span>
                    <span>{article.readTime}</span>
                  </div>
                  <h2>{article.title}</h2>
                  <p>{article.description}</p>
                  <div className="article-tags">
                    {article.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <ArrowUpRight className="article-arrow" size={21} />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </main>
  );
}
