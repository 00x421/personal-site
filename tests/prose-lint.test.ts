import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lintProse, stripProseNoise } from '../lib/prose-lint.ts';

function rulesOf(text: string): string[] {
  return lintProse(text).map((finding) => finding.rule);
}

describe('stripProseNoise', () => {
  it('围栏代码块整块抹掉且行号不漂移', () => {
    const stripped = stripProseNoise('前言\n```ts\nconst a=1;\n```\n后记');
    assert.equal(stripped.split('\n').length, 5);
    assert.ok(!stripped.includes('const a=1;'));
    assert.ok(stripped.includes('后记'));
  });

  it('链接留文字抹 URL，行内代码剥壳留字', () => {
    const stripped = stripProseNoise('看[这篇文章](/articles/a)和`localStorage`');
    assert.ok(stripped.includes('看这篇文章和localStorage'));
    assert.ok(!stripped.includes('/articles/a'));
  });

  it('裸链接抹掉', () => {
    assert.ok(!stripProseNoise('详见 https://xwsx.top/rss.xml 说明').includes('xwsx'));
  });
});

describe('lintProse', () => {
  it('中英之间缺空格 → cjk-latin-space', () => {
    assert.deepEqual(rulesOf('读完4篇'), ['cjk-latin-space']);
    assert.deepEqual(rulesOf('用React写'), ['cjk-latin-space']);
  });

  it('有空格就不报', () => {
    assert.deepEqual(lintProse('读完 4 篇，用 React 写'), []);
  });

  it('全角标点前有空格 → punct-space-before', () => {
    assert.deepEqual(rulesOf('好的 ，继续'), ['punct-space-before']);
  });

  it('中文句子用半角标点 → cjk-ascii-punct', () => {
    assert.deepEqual(rulesOf('前端,后端'), ['cjk-ascii-punct']);
    assert.deepEqual(rulesOf('前端，后端'), []);
  });

  it('数字小数点不是中文标点问题', () => {
    assert.deepEqual(lintProse('用了 5.5 年'), []);
  });

  it('纯英文行不适用这些规则', () => {
    assert.deepEqual(lintProse('```ts\nconst a=1; // ok, fine\n```'), []);
  });

  it('行号对得上', () => {
    const findings = lintProse('第一行没问题\n第二行读完4篇\n第三行没问题');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].line, 2);
  });

  it('frontmatter 数组字面量是数据语法，不按文案查', () => {
    assert.deepEqual(lintProse('tags: [前端, 性能, 字体]'), []);
  });
});
