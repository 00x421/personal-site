import type { Metadata } from 'next';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-serif-sc/700.css';
import './globals.css';
export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'), title: 'XWSX — 信我所行', description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。', alternates: { canonical: '/' }, icons: { icon: '/favicon.svg' }, openGraph: { title: 'XWSX — 信我所行', description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。', images: [{ url: '/og.png', width: 1600, height: 900, alt: '把复杂的想法，做得清晰。' }] }, twitter: { card: 'summary_large_image', title: 'XWSX — 信我所行', description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。', images: ['/og.png'] }, robots: { index: true, follow: true } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
