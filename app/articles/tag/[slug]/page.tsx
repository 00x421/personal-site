import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getArticlesByTag, getAllTags } from '@/data/articles';

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ slug: tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  const tagged = getArticlesByTag(tag);
  if (tagged.length === 0) return { title: '标签不存在 — XWSX' };
  return {
    title: `${tag} 标签下的文章 — XWSX`,
    description: `${tagged.length} 篇与「${tag}」相关的文章。`,
    alternates: { canonical: `/articles/tag/${tag}` },
    robots: { index: false, follow: true },
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tag = decodeURIComponent(slug);
  const tagged = getArticlesByTag(tag);
  if (tagged.length === 0) notFound();

  return (
    <main className="article-page">
      <div className="article-shell">
        <Link href="/articles" className="back-link">
          <ArrowLeft size={15} /> 所有文章
        </Link>
        <header className="article-index-head">
          <span className="section-index">TAG / {tagged.length} 篇</span>
          <h1>
            {tag}，
            <br />
            <em>相关的思考。</em>
          </h1>
          <p>同一标签下的文章，方便顺着一根线头读下去。</p>
        </header>
        <div className="article-list">
          {tagged.map((article, index) => (
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
        <Link href="/articles" className="article-end-link">
          查看全部文章 <ArrowUpRight size={17} />
        </Link>
      </div>
    </main>
  );
}
