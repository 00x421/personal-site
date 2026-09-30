import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkDocument,
  stripMarkdown,
  cosineSimilarity,
  retrieve,
  buildMessages,
  sanitizeQuestion,
  SlidingWindowLimiter,
  extractSseDelta,
  assertSafeBaseUrl,
  MAX_CHUNK_CHARS,
  MIN_RELEVANCE,
  type IndexedChunk,
} from '../lib/ask.ts';

test('stripMarkdown 去掉代码块/链接/图片/强调符号，保留中文正文', () => {
  const out = stripMarkdown(
    '看 `split-fonts.py` 的[实现](https://x)。\n\n```py\nprint("丢掉")\n```\n\n## **加粗**标题\n![图](a.png)',
  );
  assert.ok(out.includes('的实现。'));
  // 强调符号替换为空格，所以「加粗」「标题」之间有一个空格
  assert.ok(out.includes('加粗 标题'));
  assert.ok(!out.includes('print'));
  assert.ok(!out.includes('https://x'));
  assert.ok(!out.includes('a.png'));
  assert.ok(!out.includes('#'));
});

test('chunkDocument 按 ## 切片，引言独立成片，过短的片被过滤', () => {
  const chunks = chunkDocument({
    slug: 'demo',
    title: '演示文章',
    kind: 'article',
    body: '引言一段足够长的文字，超过二十个字符的门槛才不会被过滤掉，这里凑一凑。\n\n## 第一个小节\n\n小节内容，同样需要凑够二十个字符的长度才能通过过滤，继续写一点。\n\n## 第二节\n\n短',
  });
  assert.deepEqual(
    chunks.map((c) => c.heading),
    ['引言', '第一个小节'],
  );
  assert.equal(chunks[0].slug, 'demo');
  assert.equal(chunks[0].kind, 'article');
});

test('chunkDocument 超长小节被截断到 MAX_CHUNK_CHARS', () => {
  const chunks = chunkDocument({
    slug: 'demo',
    title: '演示文章',
    kind: 'article',
    body: `## 长节\n\n${'字'.repeat(3000)}`,
  });
  assert.equal(chunks[0].text.length, MAX_CHUNK_CHARS);
});

test('chunkDocument 没有小节头时只有引言一片', () => {
  const chunks = chunkDocument({
    slug: 'demo',
    title: '演示文章',
    kind: 'article',
    body: '只有一段正文，也要超过二十个字符的门槛，所以再补几句凑数。',
  });
  assert.deepEqual(chunks.map((c) => c.heading), ['引言']);
});

test('cosineSimilarity 平行/正交/反向/零向量', () => {
  assert.equal(cosineSimilarity([1, 0], [2, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 3]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  assert.equal(cosineSimilarity([], []), 0);
});

// 固定向量集：a 与 query 高相关，b 低相关
const INDEX: IndexedChunk[] = [
  { slug: 'a', title: '甲', kind: 'article', heading: 'h', text: 't', embedding: [1, 0.1, 0] },
  { slug: 'b', title: '乙', kind: 'project', heading: 'h', text: 't', embedding: [0, 0.2, 1] },
  { slug: 'c', title: '丙', kind: 'meta', heading: 'h', text: 't', embedding: [0.9, 0.2, 0] },
];

test('retrieve 按相似度排序并按 topK 截断', () => {
  const out = retrieve([1, 0, 0], INDEX, { topK: 2 });
  assert.deepEqual(out.map((c) => c.slug), ['a', 'c']);
});

test('retrieve 低于 MIN_RELEVANCE 的全部滤掉（宁可不答）', () => {
  const out = retrieve([0, 0, 1], INDEX, {});
  assert.deepEqual(out.map((c) => c.slug), ['b']);
  assert.ok(out[0].score >= MIN_RELEVANCE);
  const none = retrieve([0.5, -0.5, 0], INDEX, { minScore: 0.99 });
  assert.deepEqual(none, []);
});

test('buildMessages 带上系统条款、来源路径与问题', () => {
  const messages = buildMessages('字体分片是怎么回事？', [
    { title: '字体分片翻车记', path: '/articles/font', heading: '原理', text: '正文……' },
  ]);
  assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.includes('绝不编造'));
  assert.ok(messages[0].content.includes('200 字以内'));
  assert.ok(messages[1].content.includes('/articles/font'));
  assert.ok(messages[1].content.includes('字体分片是怎么回事？'));
});

test('sanitizeQuestion 去控制字符、折叠空白、截断', () => {
  assert.equal(sanitizeQuestion('  你好\u0000\u001f呀 \n 问个事  '), '你好呀 问个事');
  assert.equal(sanitizeQuestion('问'.repeat(500)).length, 300);
});

test('SlidingWindowLimiter 窗口内达到上限后拒绝，retryAfter 指向最早一击过期时刻', () => {
  let t = 1000;
  const limiter = new SlidingWindowLimiter(2, 10_000, () => t);
  assert.equal(limiter.check('ip').ok, true);
  t += 2000;
  assert.equal(limiter.check('ip').ok, true);
  t += 2000;
  const blocked = limiter.check('ip');
  assert.equal(blocked.ok, false);
  // 最早一击在 t=1000，10s 窗口 → 11000 过期，now=5000 → 还需 6s
  assert.equal(blocked.retryAfterSec, 6);
});

test('SlidingWindowLimiter 窗口滑过之后恢复；不同 key 互不影响', () => {
  let t = 1000;
  const limiter = new SlidingWindowLimiter(1, 5_000, () => t);
  assert.equal(limiter.check('a').ok, true);
  assert.equal(limiter.check('a').ok, false);
  assert.equal(limiter.check('b').ok, true);
  t += 5001;
  assert.equal(limiter.check('a').ok, true);
});

test('extractSseDelta 各类行', () => {
  assert.equal(extractSseDelta('data: {"choices":[{"delta":{"content":"你"}}]}'), '你');
  assert.equal(extractSseDelta('data: {"choices":[{"delta":{}}]}'), null);
  assert.equal(extractSseDelta('data: [DONE]'), null);
  assert.equal(extractSseDelta('data: not-json'), null);
  assert.equal(extractSseDelta(': keep-alive'), null);
  assert.equal(extractSseDelta('event: ping'), null);
});

test('assertSafeBaseUrl 只放行 https 与本地回环，去尾部斜杠', () => {
  assert.equal(assertSafeBaseUrl('https://api.siliconflow.cn/v1/'), 'https://api.siliconflow.cn/v1');
  assert.equal(assertSafeBaseUrl('http://127.0.0.1:8788/v1'), 'http://127.0.0.1:8788/v1');
  assert.equal(assertSafeBaseUrl('http://localhost:8788/v1'), 'http://localhost:8788/v1');
  assert.throws(() => assertSafeBaseUrl('http://api.example.com/v1'), /https/);
  assert.throws(() => assertSafeBaseUrl('http://192.168.1.10:8788'), /https/);
  assert.throws(() => assertSafeBaseUrl('ftp://x'), /https/);
});
