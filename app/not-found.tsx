import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: '页面走丢了 — XWSX',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="article-page">
      <div className="article-shell not-found-shell">
        <Link href="/#top" className="back-link">
          <ArrowLeft size={15} /> 返回首页
        </Link>
        <header className="article-index-head">
          <span className="section-index">404 / NOT FOUND</span>
          <h1>
            这页睡着了，
            <br />
            <em>还没被做出来。</em>
          </h1>
          <p>
            你要找的地址不存在，或者已经被移动。
            <br />
            不如从下面挑个方向继续。
          </p>
        </header>
        {/* oxlint-disable-next-line next/no-img-element -- 原创吉祥物贴图，本地静态资源按需加载即可。 */}
        <img
          className="not-found-pup"
          src="/xwsx-air-pup-sleeping-nav.png"
          alt="空气小狗趴着睡着了"
          width={140}
          height={140}
          loading="lazy"
        />
        <nav className="not-found-actions">
          <Link href="/#top">回到首页</Link>
          <Link href="/articles">看看文章</Link>
          <Link href="/#work">逛逛项目</Link>
        </nav>
      </div>
    </main>
  );
}
