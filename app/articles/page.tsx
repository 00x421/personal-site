import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { articles, getAllTags } from '@/data/articles';
import { siteIdentity } from '@/lib/site-content';

export const metadata: Metadata = {
  title: `技术文章 — ${siteIdentity.brand}`,
  description: '关于前端工程、中文排版、性能与调试的实践记录。',
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
            把实践写下来，
            <br />
            <em>让思考可复用。</em>
          </h1>
          <p>这里记录我在前端工程、中文排版与产品设计里的实践、测量和复盘。</p>
          <nav className="article-tag-cloud" aria-label="按标签浏览">
            {getAllTags().map(({ tag, count }) => (
              <Link href={`/articles/tag/${tag}`} key={tag}>
                {tag}
                <span>{count}</span>
              </Link>
            ))}
          </nav>
        </header>
        <div className="article-list">
          {articles.map((article, index) => (
            <Link
              className="article-row"
              href={`/articles/${article.slug}`}
              key={article.slug}
            >
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
          ))}
        </div>
      </div>
    </main>
  );
}
