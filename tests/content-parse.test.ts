import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  escapeXml,
  estimateReadTime,
  parseList,
  readList,
  readString,
  splitFrontmatter,
  stripComments,
  unquote,
} from '../lib/content-parse.ts';

describe('unquote', () => {
  it('去掉首尾成对的引号', () => {
    assert.equal(unquote("'2026'"), '2026');
    assert.equal(unquote('"草稿"'), '草稿');
  });

  it('不动不成对的引号', () => {
    // it's 的撇号在中间，不是包裹引号
    assert.equal(unquote("it's"), "it's");
    assert.equal(unquote("'只开了一边"), "'只开了一边");
    assert.equal(unquote('没引号'), '没引号');
  });

  it('只剥一层，不递归', () => {
    assert.equal(unquote("''内层''"), "'内层'");
  });

  it('保留空字符串（两个引号正好成对）', () => {
    assert.equal(unquote("''"), '');
  });
});

describe('splitFrontmatter', () => {
  it('拆出 frontmatter 与正文', () => {
    const { data, body } = splitFrontmatter('---\ntitle: 标题\n---\n\n正文第一段。\n');
    assert.equal(data.title, '标题');
    assert.equal(body, '\n正文第一段。\n');
  });

  it('兼容 CRLF', () => {
    const { data, body } = splitFrontmatter('---\r\ntitle: 标题\r\n---\r\n正文\r\n');
    assert.equal(data.title, '标题');
    assert.equal(body, '正文\r\n');
  });

  it('没有 frontmatter 时 data 为空、原文原样返回', () => {
    const raw = '# 只有正文\n\n没有分隔符。';
    const { data, body } = splitFrontmatter(raw);
    assert.deepEqual(data, {});
    assert.equal(body, raw);
  });

  it('只有 frontmatter 没有正文也能解析', () => {
    // 结尾的换行是可选的——项目卡片这种“只有元数据”的文件依赖这一点
    const { data, body } = splitFrontmatter('---\ntitle: 卡片\n---');
    assert.equal(data.title, '卡片');
    assert.equal(body, '');
  });

  it('把空值后面的 “- 条目” 收集为数组', () => {
    const { data } = splitFrontmatter(
      ['---', 'deliverables:', '  - 采集任务编排', '  - 反爬绕过', 'title: 之后还有键', '---', ''].join(
        '\n',
      ),
    );
    assert.deepEqual(data.deliverables, ['采集任务编排', '反爬绕过']);
    assert.equal(data.title, '之后还有键');
  });

  it('空值后面没有条目时不写入该键', () => {
    const { data } = splitFrontmatter('---\nseries:\ntitle: 标题\n---\n');
    assert.equal('series' in data, false);
    assert.equal(data.title, '标题');
  });

  it('值里含冒号时只按第一个冒号切分', () => {
    const { data } = splitFrontmatter('---\ndescription: 先说结论：字体没省下来\n---\n');
    assert.equal(data.description, '先说结论：字体没省下来');
  });

  it('跳过没有冒号的行，也跳过空键', () => {
    const { data } = splitFrontmatter('---\n这是废话\n: 没键\nok: yes\n---\n');
    assert.deepEqual(data, { ok: 'yes' });
  });

  it('取首个 frontmatter 块，正文里的 --- 不受影响', () => {
    const { data, body } = splitFrontmatter('---\ntitle: T\n---\n上文\n\n---\n\n下文\n');
    assert.equal(data.title, 'T');
    assert.ok(body.includes('下文'));
  });
});

describe('readString', () => {
  it('取到字符串', () => {
    assert.equal(readString({ title: '标题' }, 'title'), '标题');
  });

  it('空串视为缺失（`series:` 与不写等价）', () => {
    assert.equal(readString({ series: '' }, 'series'), undefined);
  });

  it('数组值不算字符串', () => {
    assert.equal(readString({ tags: ['a'] }, 'tags'), undefined);
  });

  it('缺失键返回 undefined', () => {
    assert.equal(readString({}, 'nope'), undefined);
  });
});

describe('parseList', () => {
  it('行内数组写法', () => {
    assert.deepEqual(parseList('[前端, 性能]'), ['前端', '性能']);
  });

  it('裸逗号分隔写法', () => {
    assert.deepEqual(parseList('前端, 性能, 字体'), ['前端', '性能', '字体']);
  });

  it('去掉条目自己的包裹引号', () => {
    assert.deepEqual(parseList("['Node.js', 调试]"), ['Node.js', '调试']);
  });

  it('压缩多余空格并丢弃空条目', () => {
    assert.deepEqual(parseList('  前端 ,,  性能  '), ['前端', '性能']);
  });

  it('块列表原样返回并过滤空值', () => {
    assert.deepEqual(parseList(['前端', '', '性能']), ['前端', '性能']);
  });

  it('undefined / 空串返回空数组', () => {
    assert.deepEqual(parseList(undefined), []);
    assert.deepEqual(parseList(''), []);
  });

  it('单个标签不带方括号也成立', () => {
    assert.deepEqual(parseList('调试'), ['调试']);
  });
});

describe('readList', () => {
  it('从 frontmatter 里取列表', () => {
    assert.deepEqual(readList({ tags: '[前端, 性能]' }, 'tags'), ['前端', '性能']);
    assert.deepEqual(readList({ meta: ['RPA', 'Python'] }, 'meta'), ['RPA', 'Python']);
  });

  it('缺失键返回空数组（调用方用 .length 判断回退）', () => {
    assert.deepEqual(readList({}, 'meta'), []);
  });
});

describe('stripComments', () => {
  it('去掉 HTML 注释', () => {
    assert.equal(stripComments('<!-- 占位说明 -->\n正文'), '\n正文');
  });

  it('跨行注释也能去掉', () => {
    assert.equal(stripComments('前<!--\n中间\n-->后'), '前后');
  });

  it('去掉多个注释', () => {
    assert.equal(stripComments('<!--a-->正文<!--b-->'), '正文');
  });

  it('没有注释时原样返回', () => {
    assert.equal(stripComments('正文'), '正文');
  });
});

describe('estimateReadTime', () => {
  it('不足 400 字也算 1 分钟', () => {
    assert.equal(estimateReadTime('短'), '1 min read');
    assert.equal(estimateReadTime(''), '1 min read');
  });

  it('按 400 字向上取整', () => {
    assert.equal(estimateReadTime('字'.repeat(400)), '1 min read');
    assert.equal(estimateReadTime('字'.repeat(401)), '2 min read');
    assert.equal(estimateReadTime('字'.repeat(800)), '2 min read');
    assert.equal(estimateReadTime('字'.repeat(801)), '3 min read');
  });

  it('不计 Markdown 语法字符', () => {
    // 语法字符被剔除：一串纯标记不该撑出时长
    assert.equal(estimateReadTime('#### **---** ~~~ [] () ! | _ `'), '1 min read');
  });

  it('但空白仍计入字数（现状，见 ROADMAP）', () => {
    // 实测发现的偏差：只有语法字符被剔除，换行与空格照算。
    // 所以空行多、小标题多的文章会被轻微高估。锁住现状，改动另行决策。
    const plain = '字'.repeat(400);
    const noisy = `# ${'字'.repeat(200)}\n\n## ${'字'.repeat(200)}`;
    assert.equal(estimateReadTime(plain), '1 min read');
    assert.equal(estimateReadTime(noisy), '2 min read');
  });

  it('代码块只按去掉空白后的字符数计', () => {
    const block = '```ts\nconst a = 1;\n```';
    // 代码块内所有空白被压缩掉，剩下的字符远少于 400
    assert.equal(estimateReadTime(block), '1 min read');
  });

  it('代码块里的 # 不会让结果偏小', () => {
    const withCode = `\`\`\`\n${'字'.repeat(400)}\n\`\`\``;
    assert.equal(estimateReadTime(withCode), '2 min read');
  });
});

describe('escapeXml', () => {
  it('转义 XML 五个元字符', () => {
    assert.equal(escapeXml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
  });

  it('先替换 & 避免二次转义', () => {
    // 如果 & 不是最先处理，"&lt;" 会被再次转成 "&amp;lt;"
    assert.equal(escapeXml('&lt;'), '&amp;lt;');
  });

  it('标题里的引号与书名号安全', () => {
    assert.equal(escapeXml('中文标题（副标题）'), '中文标题（副标题）');
  });

  it('纯中文与空格原样', () => {
    assert.equal(escapeXml('Node 说成功，却什么都没做'), 'Node 说成功，却什么都没做');
  });
});
