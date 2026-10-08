import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AlbumGallery } from '@/components/site/album-gallery';
import { articles } from '@/data/articles';
import { pickPhrase } from '@/lib/seal-phrases';
import { siteIdentity } from '@/lib/site-content';

export const metadata: Metadata = {
  title: `印谱 — ${siteIdentity.brand}`,
  description: '每读完一篇，文末会落下一枚闲章；它们自己集在这张谱上。',
  alternates: { canonical: '/album' },
  // 集章数据在读者本地，对搜索引擎而言这页永远是空谱——不进索引
  robots: { index: false },
};

// 章面文字与文章页同一套池子、同一套确定性映射：同一篇永远同一枚章。
// 客户端组件不能 import data/articles（会把全站 Markdown 内联进浏览器包），
// 所以在服务端把印章需要的三样东西算好传下去。
const entries = articles.map((article) => ({
  slug: article.slug,
  title: article.title,
  phrase: pickPhrase(article.slug),
}));

export default function AlbumPage() {
  return (
    <main className="article-page">
      <div className="article-shell">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} /> 回到首页
        </Link>
        <header className="article-index-head">
          <span className="section-index">ALBUM / {entries.length} 篇</span>
          <h1>
            印谱，
            <br />
            <em>一枚一章。</em>
          </h1>
          <p>
            每读完一篇，文末会落下一枚闲章。它们自己集在这张谱上——
            只存在你的浏览器里，无账号、无追踪。
          </p>
        </header>
        <AlbumGallery entries={entries} />
      </div>
    </main>
  );
}
