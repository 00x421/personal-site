import type { MetadataRoute } from 'next';
import { articles } from '@/data/articles';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return [{ url: base, lastModified: new Date() }, { url: `${base}/articles`, lastModified: new Date() }, ...articles.map((article) => ({ url: `${base}/articles/${article.slug}`, lastModified: new Date(article.published) }))];
}
