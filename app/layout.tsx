import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Linling Qi — Personal Site', description: '产品、设计与代码交汇处的个人作品集。' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
