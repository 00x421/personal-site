import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { checkGlyphCoverage, isRequiredCodepoint } from '../lib/glyph-coverage.ts';

/** 造一份只含字体分片区的最小样式表。 */
function cssWith(ranges: string[], outside = ''): string {
  return [
    outside,
    '/* @font-faces:start */',
    '@font-face {',
    "  font-family: 'Noto Serif SC';",
    "  src: url('/fonts/slices/x-s0.abc.woff2') format('woff2');",
    `  unicode-range: ${ranges.join(',')};`,
    '}',
    '/* @font-faces:end */',
  ].join('\n');
}

describe('isRequiredCodepoint', () => {
  it('CJK 表意文字需要覆盖', () => {
    assert.equal(isRequiredCodepoint('字'.codePointAt(0)!), true);
    assert.equal(isRequiredCodepoint('一'.codePointAt(0)!), true);
    assert.equal(isRequiredCodepoint('龘'.codePointAt(0)!), true);
  });

  it('CJK 标点与全角形式需要覆盖', () => {
    assert.equal(isRequiredCodepoint('、'.codePointAt(0)!), true);
    assert.equal(isRequiredCodepoint('。'.codePointAt(0)!), true);
    assert.equal(isRequiredCodepoint('「'.codePointAt(0)!), true);
    assert.equal(isRequiredCodepoint('，'.codePointAt(0)!), true);
    assert.equal(isRequiredCodepoint('？'.codePointAt(0)!), true);
  });

  it('ASCII 不需要（拉丁字形由另一套字体栈负责）', () => {
    assert.equal(isRequiredCodepoint('a'.codePointAt(0)!), false);
    assert.equal(isRequiredCodepoint(' '.codePointAt(0)!), false);
  });

  it('emoji 与符号不需要——它们永远来自访客系统字体', () => {
    // 这是刻意的，不是遗漏：把它们算进来会制造假失败。
    assert.equal(isRequiredCodepoint('🎉'.codePointAt(0)!), false);
    assert.equal(isRequiredCodepoint('→'.codePointAt(0)!), false);
    assert.equal(isRequiredCodepoint('©'.codePointAt(0)!), false);
  });
});

describe('checkGlyphCoverage · unicode-range 解析', () => {
  it('单码位与区间都能解析', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00-4E02', 'U+5B57']), []);
    // 4E00,4E01,4E02,5B57
    assert.equal(report.coveredCount, 4);
    assert.equal(report.rangeCount, 1);
  });

  it('小写十六进制同样解析', () => {
    const report = checkGlyphCoverage(cssWith(['u+4e00-4e02']), []);
    assert.equal(report.coveredCount, 3);
  });

  it('多个 @font-face 的 range 取并集', () => {
    const css = cssWith(['U+4E00']).replace(
      '/* @font-faces:end */',
      [
        '@font-face {',
        "  src: url('/fonts/slices/x-s1.def.woff2') format('woff2');",
        '  unicode-range: U+4E00-4E01;',
        '}',
        '/* @font-faces:end */',
      ].join('\n'),
    );
    const report = checkGlyphCoverage(css, []);
    assert.equal(report.rangeCount, 2);
    assert.equal(report.coveredCount, 2); // 4E00 去重
  });

  it('分片区之外的 unicode-range 不计入（那可能是别的字体）', () => {
    const outside = [
      '@font-face {',
      "  font-family: 'Other';",
      "  src: url('/x.woff2') format('woff2');",
      '  unicode-range: U+5B57;',
      '}',
    ].join('\n');
    const report = checkGlyphCoverage(cssWith(['U+4E00'], outside), []);
    assert.equal(report.rangeCount, 1);
    assert.equal(report.coveredCount, 1);
  });

  it('缺少标记时覆盖为空，且 rangeCount 为 0（供 CLI 判定无法进行）', () => {
    const report = checkGlyphCoverage(':root { --ink: #000 }', []);
    assert.equal(report.rangeCount, 0);
    assert.equal(report.coveredCount, 0);
  });
});

describe('checkGlyphCoverage · 缺失检测', () => {
  it('内容里有未覆盖的 CJK 字即报出，并标出文件名', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00-4E01']), [
      { path: 'content/articles/a.md', text: '一丁字' },
    ]);
    assert.equal(report.missing.length, 1);
    assert.equal(report.missing[0].path, 'content/articles/a.md');
    assert.deepEqual(report.missing[0].chars, ['字']);
  });

  it('同一个缺字在一份文件里只报一次', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00']), [
      { path: 'a.md', text: '字字字' },
    ]);
    assert.deepEqual(report.missing[0].chars, ['字']);
  });

  it('缺字按码位升序，便于阅读', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00']), [
      { path: 'a.md', text: '龘字一' },
    ]);
    const chars = report.missing[0].chars;
    assert.deepEqual(chars, [...chars].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!));
  });

  it('只有 ASCII / emoji 的内容永远不报缺字（避免假失败）', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00']), [
      { path: 'a.md', text: 'hello 🎉 → © 12345' },
    ]);
    assert.deepEqual(report.missing, []);
  });

  it('按文件分别归集缺失', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00']), [
      { path: 'a.md', text: '字' },
      { path: 'b.md', text: '文' },
    ]);
    assert.deepEqual(
      report.missing.map((item) => item.path),
      ['a.md', 'b.md'],
    );
  });

  it('完全覆盖时 missing 为空', () => {
    const report = checkGlyphCoverage(cssWith(['U+4E00-4EFF']), [
      { path: 'a.md', text: '一丁' },
    ]);
    assert.deepEqual(report.missing, []);
  });
});

describe('checkGlyphCoverage · 对真实产物的集成断言', () => {
  const css = readFileSync('app/globals.css', 'utf8');
  const sources = readdirSync('content', { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => {
      const full = path.join('content', entry);
      return { path: full.split(path.sep).join('/'), text: readFileSync(full, 'utf8') };
    });

  it('仓库里的内容必须被现有分片完全覆盖', () => {
    const report = checkGlyphCoverage(css, sources);
    assert.deepEqual(
      report.missing,
      [],
      `以下内容有未覆盖的字（跑 npm run fonts 重切分片）：${JSON.stringify(report.missing)}`,
    );
  });

  it('分片数量与 split-fonts.py 的产出相符（31 片）', () => {
    const report = checkGlyphCoverage(css, []);
    assert.equal(report.rangeCount, 31);
  });

  it('扫描到了内容文件（防止路径写错导致空扫描真空通过）', () => {
    assert.ok(sources.length >= 8, `只扫到 ${sources.length} 个内容文件，路径可能不对`);
  });
});
