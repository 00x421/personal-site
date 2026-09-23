import type { MetadataRoute } from 'next';
import { articles } from '@/data/articles';
import { projects } from '@/data/projects';
import { buildSitemapEntries } from '@/lib/feed-builders';

/** 组装逻辑在 `lib/feed-builders.ts`（纯函数，有测试）。 */
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries({
    articles,
    projects,
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  });
}
