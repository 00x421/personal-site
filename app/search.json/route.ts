import { articles } from '@/data/articles';
import { books } from '@/data/books';
import { projects } from '@/data/projects';
import { buildSearchEntries } from '@/lib/feed-builders';

export type { SearchEntry } from '@/lib/feed-builders';

/**
 * 全站搜索索引：构建期内容内联，运行时零文件系统。
 * 索引的组装（含 HTML 剥离与全文小写化）在 `lib/feed-builders.ts`，有测试覆盖。
 */
export function GET() {
  const entries = buildSearchEntries({ articles, projects, books });

  return new Response(JSON.stringify(entries), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
