import type { Metadata } from 'next';
import './globals.css';
import { SiteSearch } from '@/components/site/site-search';
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: 'XWSX — 信我所行',
  description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。',
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/rss.xml' },
  },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'XWSX — 信我所行',
    description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。',
    images: [
      {
        url: '/og.jpg',
        width: 1600,
        height: 900,
        alt: '把复杂的想法，做得清晰。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XWSX — 信我所行',
    description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。',
    images: ['/og.jpg'],
  },
  robots: { index: true, follow: true },
};
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Person',
      '@id': `${siteUrl}/#person`,
      name: 'Linling Qi',
      alternateName: 'XWSX',
      email: 'techlocker@163.com',
      url: siteUrl,
      sameAs: ['https://github.com/00x421'],
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'XWSX — 信我所行',
      description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。',
      publisher: { '@id': `${siteUrl}/#person` },
      inLanguage: 'zh-CN',
    },
  ],
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/slices/noto-serif-sc-500-s0.woff2"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
        <SiteSearch />
      </body>
    </html>
  );
}
