import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { CodeBlockEnhancer } from '@/components/site/code-block-enhancer';
import { NavBuddy } from '@/components/site/nav-buddy';
import { ReadingProgress } from '@/components/site/reading-progress';
import { articles, getAdjacent, getArticle, getBacklinks, getRelated, getSeries } from '@/data/articles';

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: '文章不存在 — XWSX' };
  return {
    title: `${article.title} — XWSX`,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.published,
      authors: ['Linling Qi'],
      tags: article.tags,
      images: [
        {
          url: `/og/articles/${article.slug}.png`,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: { images: [`/og/articles/${article.slug}.png`] },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const { newer, older } = getAdjacent(slug);
  const related = getRelated(slug);
  const backlinks = getBacklinks(slug);
  const series = getSeries(article.series);
  const seriesIndex = series.findIndex((item) => item.slug === slug);
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.published,
    author: {
      '@type': 'Person',
      name: 'Linling Qi',
      url: 'https://github.com/00x421',
    },
    publisher: { '@type': 'Person', name: 'Linling Qi' },
    image: `${siteUrl}/og/articles/${article.slug}.png`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${siteUrl}/articles/${article.slug}`,
    },
    articleSection: article.tags.join('、'),
    inLanguage: 'zh-CN',
  };
  return (
    <main className="article-page">
      <ReadingProgress />
      <div className="article-shell article-detail">
        <div className="article-top-row">
          <Link href="/articles" className="back-link">
            <ArrowLeft size={15} /> 所有文章
          </Link>
          {/* 阅读陪伴：文章页停留 40s 无交互小狗会打盹 */}
          <NavBuddy />
        </div>
        <article>
          <header>
            {series.length > 1 && (
              <p className="article-series">
                系列 · {article.series}
                {seriesIndex >= 0 && (
                  <span className="article-series-pos">
                    {seriesIndex + 1}/{series.length}
                  </span>
                )}
              </p>
            )}
            <div className="article-meta">
              <span>{article.published}</span>
              <span>{article.readTime}</span>
            </div>
            <h1>{article.title}</h1>
            <p className="article-lede">{article.description}</p>
            <div className="article-tags">
              {article.tags.map((tag) => (
                <Link href={`/articles/tag/${tag}`} key={tag}>
                  {tag}
                </Link>
              ))}
            </div>
          </header>
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: article.html }}
          />
        </article>
        <CodeBlockEnhancer scope=".article-detail .article-body" />
        <nav className="article-nav" aria-label="文章导航">
          {older ? (
            <Link href={`/articles/${older.slug}`} className="article-nav-card">
              <span className="article-nav-label">
                <ArrowLeft size={14} /> 上一篇
              </span>
              <strong>{older.title}</strong>
              <span className="article-nav-meta">
                {older.published} · {older.readTime}
              </span>
            </Link>
          ) : (
            <span className="article-nav-card is-empty" aria-hidden="true" />
          )}
          {newer ? (
            <Link href={`/articles/${newer.slug}`} className="article-nav-card is-next">
              <span className="article-nav-label">
                下一篇 <ArrowRight size={14} />
              </span>
              <strong>{newer.title}</strong>
              <span className="article-nav-meta">
                {newer.published} · {newer.readTime}
              </span>
            </Link>
          ) : (
            <span className="article-nav-card is-empty" aria-hidden="true" />
          )}
        </nav>
        {related.length > 0 && (
          <section className="article-related">
            <span className="section-index">RELATED / 相关阅读</span>
            <div className="article-related-grid">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/articles/${item.slug}`}
                  className="article-related-card"
                >
                  <strong>{item.title}</strong>
                  <span className="article-nav-meta">
                    {item.published} · {item.readTime}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        {series.length > 1 && (
          <section className="article-series-box" aria-label="系列文章">
            <span className="section-index">SERIES / {article.series}</span>
            <ol>
              {series.map((item, index) =>
                item.slug === slug ? (
                  <li key={item.slug} className="is-current" aria-current="page">
                    <span className="article-series-num">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <strong>{item.title}</strong>
                    <span className="article-nav-meta">本篇</span>
                  </li>
                ) : (
                  <li key={item.slug}>
                    <Link href={`/articles/${item.slug}`}>
                      <span className="article-series-num">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <strong>{item.title}</strong>
                      <span className="article-nav-meta">
                        {item.published} · {item.readTime}
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ol>
          </section>
        )}
        {backlinks.length > 0 && (
          <section className="article-backlinks" aria-label="链接到本文">
            <span className="section-index">LINKED FROM / 链接到本文</span>
            <div className="article-related-grid">
              {backlinks.map((item) => (
                <Link
                  key={item.slug}
                  href={`/articles/${item.slug}`}
                  className="article-related-card"
                >
                  <strong>{item.title}</strong>
                  <span className="article-nav-meta">
                    {item.published} · {item.readTime}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <Link href="/#top" className="article-end-link">
          回到首页 <ArrowUpRight size={17} />
        </Link>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
