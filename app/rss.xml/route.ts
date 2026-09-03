import { articles } from '@/data/articles';

const SITE_TITLE = 'XWSX — 信我所行';
const SITE_DESCRIPTION =
  'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。';

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:8787';
  const items = articles
    .map((article) => {
      const url = `${base}/articles/${article.slug}`;
      return [
        '    <item>',
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(article.published).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(article.description)}</description>`,
        `      ${article.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${base}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>zh-CN</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
