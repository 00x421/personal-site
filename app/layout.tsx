import type { Metadata } from 'next';
import { preload } from 'react-dom';
import './globals.css';
import { SiteSearch } from '@/components/site/site-search';
import { criticalFontSlices } from '@/lib/font-slices.generated';
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
  // 首屏字体预加载。三个关键片覆盖首页所有衬线文字，字节本来就要下载，
  // preload 只是把请求提前，不增加流量。
  //
  // 用 react-dom 的 preload() 而不是手写 <link>：React 19 会把 <link> 自动
  // 提升进 <head>，手写的话同一份 preload 会被输出两遍（实测 6 条）。
  // crossOrigin 必须带：@font-face 触发的请求是 CORS 模式，
  // 属性不匹配的 preload 会被浏览器丢弃并告警。
  // 文件名含内容哈希，由 split-fonts.py 生成到 lib/font-slices.generated.ts。
  for (const { href } of criticalFontSlices) {
    preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
        <SiteSearch />
        {/* 备案信息，两条。
            ICP（工信部）在前、公安在后——这与多数中文站点的惯例一致，
            也是办理顺序（先 ICP 才能办公安联网备案）。

            放在 layout 而不是首页的 .site-footer 里，是为了让所有页面都带上：
            备案检查是逐页抓取的，只放首页的话，爬到 /articles/xxx 就找不到了。

            两家的官方要求不同：
            - ICP 只要求链接到 beian.miit.gov.cn，不要求图标
            - 公安要求图标置于编号之前 */}
        <div className="site-filing">
          <a href="https://beian.miit.gov.cn/" rel="noreferrer" target="_blank">
            粤ICP备2026135612号-1
          </a>
          <span className="site-filing-sep" aria-hidden="true">
            ·
          </span>
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=44180202001182"
            rel="noreferrer"
            target="_blank"
          >
            {/* 图标是装饰性的（旁边就是文字），alt 留空避免读屏重复念一遍。
                不走 next/image：官方备案徽标是要照原样使用的 1.4 KB 静态 PNG，
                由 nginx 直服，过一遍优化管线没有收益。 */}
            {/* oxlint-disable-next-line next/no-img-element -- 官方备案徽标，原样使用。 */}
            <img src="/beian-gongan.png" alt="" width="18" height="20" />
            粤公网安备44180202001182号
          </a>
        </div>
      </body>
    </html>
  );
}
