import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { bookStatuses, books, booksByStatus } from '@/data/books';

export const metadata: Metadata = {
  title: '书架 — XWSX',
  description: '我正在读、读完和想读的书，以及每本书留下的一句话。',
  alternates: { canonical: '/books' },
};

export default function BooksPage() {
  return (
    <main className="article-page">
      <div className="article-shell">
        <Link href="/" className="back-link">
          <ArrowLeft size={15} /> 回到首页
        </Link>
        <header className="article-index-head">
          <span className="section-index">SHELF / {books.length} 本</span>
          <h1>
            书架，
            <br />
            <em>慢一点也没关系。</em>
          </h1>
          <p>
            输入决定输出。这里记录我正在读、读完和想读的书，
            以及每本书留在我身上的一句话。
          </p>
        </header>
        {bookStatuses.map((status) => {
          const group = booksByStatus(status);
          if (group.length === 0) return null;
          return (
            <section className="book-group" key={status}>
              <span className="book-group-index">
                {status} / {group.length}
              </span>
              <ul>
                {group.map((book) => (
                  <li className="book-row" key={book.slug}>
                    <div className="book-title-row">
                      <h2>{book.title}</h2>
                      {book.started && (
                        <span className="book-started">{book.started}</span>
                      )}
                    </div>
                    <span className="book-author">{book.author}</span>
                    {book.takeaway && (
                      <blockquote className="book-takeaway">
                        {book.takeaway}
                      </blockquote>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <Link href="/articles" className="article-end-link">
          顺便看看文章 <ArrowUpRight size={17} />
        </Link>
      </div>
    </main>
  );
}
