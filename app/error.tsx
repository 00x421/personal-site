'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

/**
 * 路由级错误边界：页面渲染抛错时接管，沿用 404 的编辑风与语气，
 * 避免掉进框架默认错误页。这里是客户端组件，可以提供重试。
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 生产构建下客户端拿不到堆栈，统一在这里留一个落点便于排查
    console.error(error);
  }, [error]);

  return (
    <main className="article-page">
      <div className="article-shell not-found-shell">
        <Link href="/#top" className="back-link">
          <ArrowLeft size={15} /> 返回首页
        </Link>
        <header className="article-index-head">
          <span className="section-index">ERROR / 出了点意外</span>
          <h1>
            这一页，
            <br />
            <em>小狗绊了一下。</em>
          </h1>
          <p>
            渲染内容时出了问题，不是你的错。
            <br />
            重试一次，或者换个方向继续走。
          </p>
        </header>
        {/* oxlint-disable-next-line next/no-img-element -- 原创吉祥物贴图，本地静态资源按需加载即可。 */}
        <img
          className="not-found-pup"
          src="/xwsx-air-pup-thinking-nav.png"
          alt="空气小狗歪着头看着出错的页面"
          width={140}
          height={140}
        />
        <nav className="not-found-actions">
          <button type="button" onClick={reset}>
            重试一次
          </button>
          <Link href="/#top">回到首页</Link>
          <Link href="/articles">看看文章</Link>
        </nav>
      </div>
    </main>
  );
}
