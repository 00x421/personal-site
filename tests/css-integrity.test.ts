import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { checkGlobalsCss, cssIntegrityRules } from '../lib/css-integrity.ts';

/**
 * `app/globals.css` 结构断言的单测。
 *
 * 这些断言的存在理由见 `lib/css-integrity.ts` 头部：项目两次样式表事故
 * （`DONE :root` 拼接、明暗配色只写一半）都是「不报错但整块失效」，只能靠
 * 字符串性质拦住。所以这里既测「坏输入会被抓到」，也测「好输入不会误报」——
 * 后者同样重要，否则维护者会开始忽略这个检查。
 */

/** 一份能通过全部四项断言的最小样式表，供各用例逐项注入缺陷。 */
function validCss(): string {
  return [
    '/* @font-faces:start */',
    '@font-face {',
    "  font-family: 'Noto Serif SC';",
    "  src: url('/fonts/slices/x-s0.abc.woff2') format('woff2');",
    '  unicode-range: U+20-7E,U+4E00;',
    '}',
    '/* @font-faces:end */',
    ':root {',
    '  --ink: #17171b;',
    '  --paper: #f4f2ec;',
    '  --line: #d8d6ce;',
    '  --violet: #7867e8;',
    '  --muted: #63625c;',
    '  --raised: #eceae2;',
    '  --body-text: #4e4d49;',
    '  --card-ink: #1c1c20;',
    '  --card-ink-text: #f5f4ef;',
    '  --noise-opacity: 0.05;',
    '}',
    "[data-theme='dark'] {",
    '  --ink: #ece9e1;',
    '  --paper: #141416;',
    '  --line: #2c2c31;',
    '  --violet: #9186f0;',
    '  --muted: #97968f;',
    '  --raised: #1d1d21;',
    '  --body-text: #bebcb4;',
    '  --card-ink: #232328;',
    '  --card-ink-text: #f0ede5;',
    '  --noise-opacity: 0.07;',
    '}',
    '.card {',
    '  color: var(--ink);',
    '  background: var(--raised);',
    '  box-shadow: 0 12px 20px rgb(0 0 0 / 0.12);',
    '}',
  ].join('\n');
}

const errorCodes = (css: string) =>
  checkGlobalsCss(css)
    .filter((finding) => finding.level === 'error')
    .map((finding) => finding.code);

describe('checkGlobalsCss · 基线', () => {
  it('干净的样式表零发现', () => {
    assert.deepEqual(checkGlobalsCss(validCss()), []);
  });

  it('rgb() 阴影不算裸色值（阴影透明度本就是主题中性的）', () => {
    assert.deepEqual(errorCodes(validCss()), []);
  });
});

describe('checkGlobalsCss · 字体分片区', () => {
  it('缺少标记即报错（标记是 split-fonts.py 的写入锚点）', () => {
    const css = validCss().replace('/* @font-faces:start */', '');
    assert.deepEqual(errorCodes(css), ['font-faces-marker-missing']);
  });

  it('标记顺序反转即报错', () => {
    const css = validCss()
      .replace('/* @font-faces:start */', '/* @font-faces:end */')
      .replace('\n/* @font-faces:end */', '\n/* @font-faces:start */');
    assert.ok(errorCodes(css).includes('font-faces-marker-order'));
  });

  it('区域里混进脚本收尾文本即报错（2026-09 线上故障的形态）', () => {
    // 事故：脚本打印的 DONE 被写进样式表，压缩后与紧随其后的 :root 拼成
    // 选择器 `DONE :root`，匹配不到元素，整块 CSS 变量失效。
    const css = validCss().replace(
      '/* @font-faces:end */',
      'DONE\n/* @font-faces:end */',
    );
    assert.ok(errorCodes(css).includes('font-faces-region-polluted'));
  });

  it('区域里出现 @font-face 之外的规则即报错', () => {
    const css = validCss().replace(
      '/* @font-faces:end */',
      '.oops { color: red }\n/* @font-faces:end */',
    );
    assert.ok(errorCodes(css).includes('font-faces-region-polluted'));
  });

  it('区域内的注释不算污染（脚本与说明都写在注释里）', () => {
    const css = validCss().replace(
      '/* @font-faces:end */',
      '/* split-fonts.py 生成，勿手改 */\n/* @font-faces:end */',
    );
    assert.ok(!errorCodes(css).includes('font-faces-region-polluted'));
  });
});

describe('checkGlobalsCss · :root 完整性', () => {
  it('完全没有 :root 即报错', () => {
    const css = validCss().replace(/^:root \{[\s\S]*?\}$/m, '');
    assert.ok(errorCodes(css).includes('root-block-missing'));
  });

  it('选择器被拼接成 `DONE :root` 时视为 :root 缺失（正是故障形态）', () => {
    const css = validCss().replace('^', '').replace(/\n:root \{/, '\nDONE :root {');
    assert.ok(errorCodes(css).includes('root-block-missing'));
  });

  it('缺一个必需变量即报错（整块变量被误删的情形）', () => {
    const css = validCss().replace('  --noise-opacity: 0.05;\n', '');
    assert.ok(errorCodes(css).includes('root-tokens-missing'));
  });

  it('两个主题块一起被清空时也能抓到（成对性检查会真空通过，所以需要这条）', () => {
    const css = validCss()
      .replace(/^:root \{[\s\S]*?\}$/m, ':root {}\n')
      .replace(/^\[data-theme='dark'\] \{[\s\S]*?\}$/m, '');
    assert.ok(errorCodes(css).includes('root-tokens-missing'));
  });
});

describe('checkGlobalsCss · 明暗主题成对', () => {
  it('只在 :root 定义、暗色没覆盖即报错', () => {
    const css = validCss().replace('  --raised: #1d1d21;\n', '');
    assert.ok(errorCodes(css).includes('theme-token-unpaired'));
  });

  it('登记在 THEME_INDEPENDENT 里的变量不需要暗色覆盖', () => {
    // 把全部例外变量都注入进 :root，逐个证明它们不会触发成对性报错。
    // 这样 THEME_INDEPENDENT 新增条目时，测试会自动覆盖到新条目。
    const injections = [...cssIntegrityRules.THEME_INDEPENDENT].map(
      (token, index) => `  ${token}: ${index}px;`,
    );
    const css = validCss().replace(
      '  --noise-opacity: 0.05;',
      ['  --noise-opacity: 0.05;', ...injections].join('\n'),
    );
    for (const token of cssIntegrityRules.THEME_INDEPENDENT) {
      assert.ok(css.includes(token), `样例应覆盖例外变量 ${token}`);
    }
    assert.ok(!errorCodes(css).includes('theme-token-unpaired'));
  });

  it('缺少暗色主题块即报错', () => {
    const css = validCss().replace(/^\[data-theme='dark'\] \{[\s\S]*?\}$/m, '');
    assert.ok(errorCodes(css).includes('dark-theme-missing'));
  });

  it('只在暗色定义的变量给出 warn（亮色取不到值）', () => {
    const css = validCss().replace(
      '  --noise-opacity: 0.07;',
      '  --noise-opacity: 0.07;\n  --orphan: #fff;',
    );
    const finding = checkGlobalsCss(css).find(
      (item) => item.code === 'theme-token-orphan',
    );
    assert.ok(finding);
    assert.equal(finding.level, 'warn');
  });
});

describe('checkGlobalsCss · 裸色值', () => {
  it('规则里写死十六进制色值即报错（不会跟随主题切换）', () => {
    const css = validCss().replace(
      '.card {',
      '.plate {\n  background: #f6f2e8;\n}\n.card {',
    );
    assert.ok(errorCodes(css).includes('bare-color-literal'));
  });

  it('token 块里的十六进制不算裸色值（那正是变量的定义处）', () => {
    assert.ok(!errorCodes(validCss()).includes('bare-color-literal'));
  });

  it('缩写三位的十六进制同样被抓到', () => {
    const css = validCss().replace('.card {', '.plate {\n  border-color: #fff;\n}\n.card {');
    assert.ok(errorCodes(css).includes('bare-color-literal'));
  });

  it('报错信息里带上违规的声明，便于定位', () => {
    const css = validCss().replace('.card {', '.plate {\n  background: #f6f2e8;\n}\n.card {');
    const finding = checkGlobalsCss(css).find(
      (item) => item.code === 'bare-color-literal',
    );
    assert.ok(finding?.message.includes('#f6f2e8'));
  });
});

describe('checkGlobalsCss · 对真实 app/globals.css 的集成断言', () => {
  const css = readFileSync('app/globals.css', 'utf8');

  it('仓库里的样式表必须零 error', () => {
    const errors = checkGlobalsCss(css).filter((item) => item.level === 'error');
    assert.deepEqual(
      errors.map((item) => item.code),
      [],
      `app/globals.css 结构自检失败：${errors.map((item) => item.message).join(' / ')}`,
    );
  });

  it('字体分片区确实存在且被标记包围', () => {
    assert.ok(css.includes(cssIntegrityRules.FONT_FACES_START));
    assert.ok(css.includes(cssIntegrityRules.FONT_FACES_END));
  });
});
