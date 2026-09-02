import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from '@/components/motion';
import { articles } from '@/data/articles';

/** 技术文章区：卡片滚动入场，站内跳转使用 next/link */
export function Writing() {
  return (
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
      <div className="writing-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {articles.map((article, index) => (
          <Reveal key={article.slug} delay={index * 0.08} className="writing-cell">
            <Link className="writing-card" href={`/articles/${article.slug}`}>
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
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
