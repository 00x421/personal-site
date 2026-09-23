import { articles } from '@/data/articles';
import { buildRssXml } from '@/lib/feed-builders';
import { siteDescription, siteTitle } from '@/lib/site-content';

/**
 * RSS 2.0。序列化逻辑在 `lib/feed-builders.ts`（纯函数，有测试）；
 * 这里只负责取数据、包响应头。
 */
export function GET() {
  const xml = buildRssXml(articles, {
    baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    title: siteTitle,
    description: siteDescription,
  });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
