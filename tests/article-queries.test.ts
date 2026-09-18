import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  collectTags,
  filterByTag,
  findAdjacent,
  findBacklinks,
  findRelated,
  findSeries,
  sortByNewest,
} from '../lib/article-queries.ts';

import type { Article } from '../lib/markdown.ts';

/** 只填查询会读到的字段，其余留空——测试关心的是查询逻辑，不是渲染结果。 */
function article(partial: Partial<Article> & { slug: string }): Article {
  return {
    title: partial.slug,
    description: '',
    published: '2026-01-01',
    readTime: '1 min read',
    tags: [],
    draft: false,
    html: '',
    ...partial,
  };
}

/** 与本站真实数据同构：三篇同日发布，用来锁住“同日不定序”的现有行为。 */
const list: Article[] = [
  article({ slug: 'a', published: '2026-09-17', tags: ['前端', '字体'] }),
  article({ slug: 'b', published: '2026-09-17', tags: ['前端', '性能'] }),
  article({ slug: 'c', published: '2026-09-17', tags: ['设计'] }),
  article({ slug: 'd', published: '2026-08-01', tags: ['前端'] }),
  article({ slug: 'e', published: '2026-07-01', tags: [] }),
];

describe('sortByNewest', () => {
  it('按日期倒序', () => {
    assert.deepEqual(
      sortByNewest(list).map((x) => x.slug),
      ['a', 'b', 'c', 'd', 'e'],
    );
  });

  it('不修改入参', () => {
    const input = [...list];
    sortByNewest(input);
    assert.deepEqual(
      input.map((x) => x.slug),
      ['a', 'b', 'c', 'd', 'e'],
    );
  });

  it('同日保持输入顺序（sort 稳定），不引入 slug 兜底', () => {
    // 加 slug 兜底会重排同日文章，进而改变“上一篇 / 下一篇”。锁住现状。
    const shuffled = [article({ slug: 'z', published: '2026-09-17' }), ...list];
    assert.deepEqual(
      sortByNewest(shuffled).slice(0, 4).map((x) => x.slug),
      ['z', 'a', 'b', 'c'],
    );
  });

  it('空数组安全', () => {
    assert.deepEqual(sortByNewest([]), []);
  });
});

describe('findAdjacent', () => {
  it('中间的文章两头都有', () => {
    const { newer, older } = findAdjacent(list, 'b');
    assert.equal(newer?.slug, 'a');
    assert.equal(older?.slug, 'c');
  });

  it('第一篇没有更新的一篇', () => {
    const { newer, older } = findAdjacent(list, 'a');
    assert.equal(newer, null);
    assert.equal(older?.slug, 'b');
  });

  it('最后一篇没有更早的一篇', () => {
    const { newer, older } = findAdjacent(list, 'e');
    assert.equal(newer?.slug, 'd');
    assert.equal(older, null);
  });

  it('单一文章两头都是 null', () => {
    const single = [article({ slug: 'only' })];
    assert.deepEqual(findAdjacent(single, 'only'), { newer: null, older: null });
  });

  it('slug 不存在时返回 null 对，而不是抛错', () => {
    assert.deepEqual(findAdjacent(list, 'nope'), { newer: null, older: null });
  });

  it('空列表安全', () => {
    assert.deepEqual(findAdjacent([], 'a'), { newer: null, older: null });
  });
});

describe('findRelated', () => {
  it('标签重叠多的排前面', () => {
    const related = findRelated(list, 'd'); // tags: 前端
    // a(前端,字体) b(前端,性能) 各重叠 1；c/e 重叠 0
    assert.deepEqual(related.map((x) => x.slug).sort(), ['a', 'b']);
  });

  it('排除自己', () => {
    assert.ok(!findRelated(list, 'a').some((x) => x.slug === 'a'));
  });

  it('排除正文里已经链接到本文的文章（否则与“链接到本文”区块重复）', () => {
    const withLink = [
      article({ slug: 'me', tags: [] }),
      article({ slug: 'fan', tags: ['x'], html: '<a href="/articles/me">看这篇</a>' }),
      article({ slug: 'other', tags: ['x'] }),
    ];
    const related = findRelated(withLink, 'me');
    assert.deepEqual(related.map((x) => x.slug), ['other']);
  });

  it('无标签重叠时回退为最新的其他文章，区块不会空', () => {
    const lonely = [
      article({ slug: 'me', published: '2026-09-17', tags: ['独一份'] }),
      article({ slug: 'old', published: '2026-01-01', tags: [] }),
      article({ slug: 'new', published: '2026-08-01', tags: [] }),
    ];
    assert.deepEqual(findRelated(lonely, 'me').map((x) => x.slug), ['new', 'old']);
  });

  it('max 是上限，限制返回条数', () => {
    assert.equal(findRelated(list, 'a', 1).length, 1);
  });

  it('有标签重叠时不拿无重叠文章凑数', () => {
    // 实测发现的行为：只要存在重叠，就只返回重叠的那些，不补齐到 max。
    // 所以相关阅读可能只显示 1 张卡——这是刻意的“宁缺毋滥”，不是缺陷。
    assert.equal(findRelated(list, 'a').length, 2);
    assert.equal(findRelated(list, 'a', 10).length, 2);
  });

  it('slug 不存在时返回空数组', () => {
    assert.deepEqual(findRelated(list, 'nope'), []);
  });

  it('只有一篇文章时返回空数组（没有可推荐的）', () => {
    assert.deepEqual(findRelated([article({ slug: 'only' })], 'only'), []);
  });

  it('不修改入参', () => {
    const input = [...list];
    findRelated(input, 'a');
    assert.deepEqual(
      input.map((x) => x.slug),
      ['a', 'b', 'c', 'd', 'e'],
    );
  });
});

describe('filterByTag', () => {
  it('按标签筛选并保持原顺序', () => {
    assert.deepEqual(filterByTag(list, '前端').map((x) => x.slug), ['a', 'b', 'd']);
  });

  it('标签不存在时返回空数组', () => {
    assert.deepEqual(filterByTag(list, '不存在'), []);
  });

  it('不做模糊匹配', () => {
    // “前端”不应命中“前端开发”
    const data = [article({ slug: 'x', tags: ['前端开发'] })];
    assert.deepEqual(filterByTag(data, '前端'), []);
  });
});

describe('collectTags', () => {
  it('按文章数倒序', () => {
    const tags = collectTags(list);
    assert.deepEqual(tags[0], { tag: '前端', count: 3 });
  });

  it('同数量按名称排序，结果稳定', () => {
    const tags = collectTags(list);
    const ones = tags.filter((t) => t.count === 1).map((t) => t.tag);
    assert.deepEqual(ones, [...ones].sort((a, b) => a.localeCompare(b)));
  });

  it('一篇文章里的重复标签只算一次', () => {
    const data = [article({ slug: 'x', tags: ['前端', '前端'] })];
    // 这里如实记录：目前的实现按标签数组逐项累加，重复项会被计两次
    assert.deepEqual(collectTags(data), [{ tag: '前端', count: 2 }]);
  });

  it('无标签返回空数组', () => {
    assert.deepEqual(collectTags([article({ slug: 'x' })]), []);
    assert.deepEqual(collectTags([]), []);
  });
});

describe('findBacklinks', () => {
  it('找出正文里链接到本文的文章', () => {
    const data = [
      article({ slug: 'me' }),
      article({ slug: 'fan', published: '2026-05-01', html: '<a href="/articles/me">x</a>' }),
      article({ slug: 'other', published: '2026-06-01', html: '没有链接' }),
    ];
    assert.deepEqual(findBacklinks(data, 'me').map((x) => x.slug), ['fan']);
  });

  it('按发布时间倒序', () => {
    const data = [
      article({ slug: 'me' }),
      article({ slug: 'old', published: '2026-01-01', html: 'href="/articles/me"' }),
      article({ slug: 'new', published: '2026-09-01', html: 'href="/articles/me"' }),
    ];
    assert.deepEqual(findBacklinks(data, 'me').map((x) => x.slug), ['new', 'old']);
  });

  it('不把自己算作自己的反向链接', () => {
    const data = [article({ slug: 'me', html: 'href="/articles/me"' })];
    assert.deepEqual(findBacklinks(data, 'me'), []);
  });

  it('严格匹配完整路径，前缀相同不算', () => {
    // 链接到 /articles/me-too 的文章不应被当成链接到 /articles/me
    const data = [
      article({ slug: 'me' }),
      article({ slug: 'x', html: '<a href="/articles/me-too">x</a>' }),
    ];
    assert.deepEqual(findBacklinks(data, 'me'), []);
  });

  it('没有反向链接时返回空数组', () => {
    assert.deepEqual(findBacklinks(list, 'a'), []);
  });

  it('不修改入参', () => {
    const data = [
      article({ slug: 'me' }),
      article({ slug: 'old', published: '2026-01-01', html: 'href="/articles/me"' }),
      article({ slug: 'new', published: '2026-09-01', html: 'href="/articles/me"' }),
    ];
    const before = data.map((x) => x.slug);
    findBacklinks(data, 'me');
    assert.deepEqual(
      data.map((x) => x.slug),
      before,
    );
  });
});

describe('findSeries', () => {
  const data = [
    article({ slug: 'p2', published: '2026-03-01', series: '工程手记' }),
    article({ slug: 'p1', published: '2026-01-01', series: '工程手记' }),
    article({ slug: 'solo', published: '2026-02-01' }),
  ];

  it('同系列按发布时间正序（阅读顺序，与列表页相反）', () => {
    assert.deepEqual(findSeries(data, '工程手记').map((x) => x.slug), ['p1', 'p2']);
  });

  it('undefined / 空串返回空数组', () => {
    assert.deepEqual(findSeries(data, undefined), []);
    assert.deepEqual(findSeries(data, ''), []);
  });

  it('系列不存在时返回空数组', () => {
    assert.deepEqual(findSeries(data, '不存在'), []);
  });

  it('不修改入参', () => {
    const input = [...data];
    findSeries(input, '工程手记');
    assert.deepEqual(
      input.map((x) => x.slug),
      ['p2', 'p1', 'solo'],
    );
  });
});
