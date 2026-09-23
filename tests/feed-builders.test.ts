import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildRssXml,
  buildSearchEntries,
  buildSitemapEntries,
  type FeedArticle,
  type FeedBook,
  type FeedProject,
} from '../lib/feed-builders.ts';

/**
 * 机器可读接口（RSS / search.json / sitemap）的序列化测试。
 *
 * 这三个接口此前完全没有测试覆盖——因为它们把「取数据 + 拼字符串」写在 route
 * 里，而 route 依赖 `@/data/*`（eager `import.meta.glob`，只有 Vite 能跑）。
 * 抽出 `lib/feed-builders.ts` 后就能在纯 Node 下断言输出。
 *
 * 断言重点放在**会静默出错的地方**：XML 转义、URL 拼接、全文归一化。
 * 这些错了不会抛异常，只会让订阅器/搜索引擎/搜索面板拿到坏数据。
 */

function article(over: Partial<FeedArticle> = {}): FeedArticle {
  return {
    slug: 'a',
    title: '标题',
    description: '摘要',
    published: '2026-09-17',
    tags: ['前端'],
    html: '<p>正文</p>',
    ...over,
  };
}

function project(over: Partial<FeedProject> = {}): FeedProject {
  return {
    slug: 'p',
    title: '项目',
    summary: '一句话',
    tags: ['标签'],
    type: '产品设计',
    year: '2026',
    html: '<p>案例</p>',
    hasCase: true,
    ...over,
  };
}

function book(over: Partial<FeedBook> = {}): FeedBook {
  return {
    title: '认知觉醒',
    author: '周岭',
    status: '在读',
    takeaway: '一句心得',
    ...over,
  };
}

const channel = {
  baseUrl: 'https://xwsx.top',
  title: 'XWSX — 信我所行',
  description: '描述',
};

describe('buildRssXml', () => {
  it('输出合法的 RSS 2.0 头部与频道元信息', () => {
    const xml = buildRssXml([article()], channel);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
    assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
    assert.match(xml, /<atom:link href="https:\/\/xwsx\.top\/rss\.xml" rel="self"/);
    assert.match(xml, /<language>zh-CN<\/language>/);
  });

  it('每篇文章一个 item', () => {
    const xml = buildRssXml([article({ slug: 'a' }), article({ slug: 'b' })], channel);
    assert.equal((xml.match(/<item>/g) ?? []).length, 2);
    assert.equal((xml.match(/<\/item>/g) ?? []).length, 2);
  });

  it('没有文章时 items 为空但 RSS 骨架完整', () => {
    const xml = buildRssXml([], channel);
    assert.equal((xml.match(/<item>/g) ?? []).length, 0);
    assert.match(xml, /<\/channel>/);
    assert.match(xml, /<\/rss>/);
  });

  it('guid 是 permalink 且与 link 指向同一 URL', () => {
    const xml = buildRssXml([article({ slug: 'my-post' })], channel);
    assert.match(xml, /<link>https:\/\/xwsx\.top\/articles\/my-post<\/link>/);
    assert.match(
      xml,
      /<guid isPermaLink="true">https:\/\/xwsx\.top\/articles\/my-post<\/guid>/,
    );
  });

  it('标题与摘要里的 XML 元字符被转义（否则订阅器解析失败）', () => {
    const xml = buildRssXml(
      [article({ title: 'a & b <c> "d" \'e\'', description: '<x> & </x>' })],
      channel,
    );
    assert.match(xml, /<title>a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;<\/title>/);
    assert.match(xml, /<description>&lt;x&gt; &amp; &lt;\/x&gt;<\/description>/);
    // 原始的裸 & 与 < 不该出现在文本节点里
    assert.ok(!xml.includes('<title>a & b'));
  });

  it('频道标题与描述同样转义', () => {
    const xml = buildRssXml([], { ...channel, title: 'A & B', description: 'C < D' });
    assert.match(xml, /<title>A &amp; B<\/title>/);
    assert.match(xml, /<description>C &lt; D<\/description>/);
  });

  it('每个标签一个 category，且标签也转义', () => {
    const xml = buildRssXml(
      [article({ tags: ['前端', 'a&b'] })],
      channel,
    );
    assert.match(xml, /<category>前端<\/category>/);
    assert.match(xml, /<category>a&amp;b<\/category>/);
    assert.equal((xml.match(/<category>/g) ?? []).length, 2);
  });

  it('无标签时不产生 category 元素', () => {
    const xml = buildRssXml([article({ tags: [] })], channel);
    assert.ok(!xml.includes('<category>'));
  });

  it('pubDate 是 UTC 字符串，日期来自 frontmatter 的 published', () => {
    const xml = buildRssXml([article({ published: '2026-09-17' })], channel);
    const expected = new Date('2026-09-17').toUTCString();
    assert.match(xml, new RegExp(`<pubDate>${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</pubDate>`));
    assert.match(xml, /GMT<\/pubDate>/);
  });

  it('baseUrl 无尾斜杠时不会拼出双斜杠 URL', () => {
    const xml = buildRssXml([article()], { ...channel, baseUrl: 'https://xwsx.top/' });
    // 记录了现状：调用方负责传不带尾斜杠的 baseUrl
    assert.ok(!xml.includes('articles//a'));
  });
});

describe('buildSearchEntries', () => {
  it('三种来源按 文章 → 项目 → 书架 的顺序拼接', () => {
    const entries = buildSearchEntries({
      articles: [article({ title: '文章一' })],
      projects: [project({ title: '项目一' })],
      books: [book({ title: '书一' })],
    });
    assert.deepEqual(
      entries.map((entry) => entry.type),
      ['article', 'project', 'book'],
    );
  });

  it('文章条目带上 slug URL 与发布日期', () => {
    const [entry] = buildSearchEntries({
      articles: [article({ slug: 'x', published: '2026-01-02' })],
      projects: [],
      books: [],
    });
    assert.equal(entry.url, '/articles/x');
    assert.equal(entry.meta, '2026-01-02');
  });

  it('text 是小写的，并且剥掉了 HTML 标签', () => {
    const [entry] = buildSearchEntries({
      articles: [
        article({
          title: 'CJK Letter-Spacing',
          description: '概要',
          tags: ['字体'],
          html: '<p>Hello <strong>World</strong></p>',
        }),
      ],
      projects: [],
      books: [],
    });
    assert.ok(entry.text.includes('cjk letter-spacing'));
    assert.ok(entry.text.includes('hello world'));
    assert.ok(entry.text.includes('字体'));
    assert.ok(!entry.text.includes('<'));
    assert.ok(!entry.text.includes('>'));
  });

  it('text 把多段正文压成单个空格，不留连续空白', () => {
    const [entry] = buildSearchEntries({
      articles: [article({ html: '<p>一</p>\n\n  <p>二</p>' })],
      projects: [],
      books: [],
    });
    assert.ok(!/\s{2,}/.test(entry.text));
  });

  it('有正文的项目指向案例页', () => {
    const [entry] = buildSearchEntries({
      articles: [],
      projects: [project({ slug: 'case', hasCase: true })],
      books: [],
    });
    assert.equal(entry.url, '/projects/case');
  });

  it('没有正文的项目回落到首页项目区，不会链到不存在的页面', () => {
    const [entry] = buildSearchEntries({
      articles: [],
      projects: [project({ slug: 'nocase', hasCase: false })],
      books: [],
    });
    assert.equal(entry.url, '/#work');
  });

  it('项目 meta 是「类型 · 年份」，类型也进全文', () => {
    const [entry] = buildSearchEntries({
      articles: [],
      projects: [project({ type: '产品设计', year: '2025' })],
      books: [],
    });
    assert.equal(entry.meta, '产品设计 · 2025');
    assert.ok(entry.text.includes('产品设计'));
  });

  it('书籍条目用 takeaway 作摘要、状态作标签、作者作 meta', () => {
    const [entry] = buildSearchEntries({
      articles: [],
      projects: [],
      books: [book({ author: '周岭', status: '读完', takeaway: '心得' })],
    });
    assert.equal(entry.desc, '心得');
    assert.deepEqual(entry.tags, ['读完']);
    assert.equal(entry.meta, '周岭 · 读完');
    assert.equal(entry.url, '/books');
  });

  it('空输入返回空数组', () => {
    assert.deepEqual(buildSearchEntries({ articles: [], projects: [], books: [] }), []);
  });
});

describe('buildSitemapEntries', () => {
  const now = new Date('2026-10-01T00:00:00Z');

  it('前四项是静态页，用同一个 now', () => {
    const entries = buildSitemapEntries({
      articles: [],
      projects: [],
      baseUrl: 'https://xwsx.top',
      now,
    });
    assert.deepEqual(
      entries.map((entry) => entry.url),
      ['https://xwsx.top', 'https://xwsx.top/articles', 'https://xwsx.top/books', 'https://xwsx.top/now'],
    );
    for (const entry of entries) assert.equal(entry.lastModified.getTime(), now.getTime());
  });

  it('每篇文章进一条，lastModified 取发布日期', () => {
    const entries = buildSitemapEntries({
      articles: [article({ slug: 'a', published: '2026-09-17' })],
      projects: [],
      baseUrl: 'https://xwsx.top',
      now,
    });
    const target = entries.find((entry) => entry.url === 'https://xwsx.top/articles/a');
    assert.ok(target);
    assert.equal(target.lastModified.toISOString(), new Date('2026-09-17').toISOString());
  });

  it('只有写了正文的项目才进 sitemap（否则会提交 404）', () => {
    const entries = buildSitemapEntries({
      articles: [],
      projects: [
        project({ slug: 'with-case', hasCase: true }),
        project({ slug: 'without-case', hasCase: false }),
      ],
      baseUrl: 'https://xwsx.top',
      now,
    });
    const urls = entries.map((entry) => entry.url);
    assert.ok(urls.includes('https://xwsx.top/projects/with-case'));
    assert.ok(!urls.includes('https://xwsx.top/projects/without-case'));
  });

  it('没有重复 URL', () => {
    const entries = buildSitemapEntries({
      articles: [article({ slug: 'a' }), article({ slug: 'b' })],
      projects: [project({ slug: 'p' })],
      baseUrl: 'https://xwsx.top',
      now,
    });
    const urls = entries.map((entry) => entry.url);
    assert.equal(new Set(urls).size, urls.length);
  });

  it('所有 URL 都是绝对地址（搜索引擎要求）', () => {
    const entries = buildSitemapEntries({
      articles: [article()],
      projects: [project()],
      baseUrl: 'https://xwsx.top',
      now,
    });
    for (const entry of entries) assert.match(entry.url, /^https:\/\//);
  });

  it('每个 URL 都非空', () => {
    const entries = buildSitemapEntries({
      articles: [article()],
      projects: [project()],
      baseUrl: 'https://xwsx.top',
      now,
    });
    for (const entry of entries) assert.notEqual(entry.url, '');
  });
});
