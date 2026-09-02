import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-serif-sc/700.css';
import './globals.css';

/**
 * 主题无闪烁初始化：在任何内容渲染前读取 localStorage（或跟随系统偏好），
 * 提前设置 <html data-theme>，避免暗色用户看到亮色闪屏。
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    images: [{ url: '/og.png', width: 1600, height: 900, alt: '把复杂的想法，做得清晰。' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.title,
    description: siteConfig.description,
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
