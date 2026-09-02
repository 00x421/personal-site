import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { articles, getArticle } from '@/data/articles';

export function generateStaticParams() { return articles.map((article) => ({ slug: article.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: '文章不存在 — XWSX' };
  return { title: `${article.title} — XWSX`, description: article.description, alternates: { canonical: `/articles/${article.slug}` }, openGraph: { title: article.title, description: article.description, type: 'article', publishedTime: article.published, authors: ['Linling Qi'], tags: article.tags, images: [] }, twitter: { images: [] } };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description, datePublished: article.published, author: { '@type': 'Person', name: 'Linling Qi' } };
  return <main className="article-page"><div className="article-shell article-detail"><Link href="/articles" className="back-link"><ArrowLeft size={15} /> 所有文章</Link><article><header><div className="article-meta"><span>{article.published}</span><span>{article.readTime}</span></div><h1>{article.title}</h1><p className="article-lede">{article.description}</p><div className="article-tags">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></header><div className="article-body">{article.body.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</div></article><Link href="/#top" className="article-end-link">回到首页 <ArrowUpRight size={17} /></Link></div><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /></main>;
}
