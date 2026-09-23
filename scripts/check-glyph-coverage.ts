/**
 * 字形覆盖门禁：内容里出现、但字体分片没声明的字 → 构建失败。
 *
 *   node --experimental-strip-types scripts/check-glyph-coverage.ts
 *
 * 为什么必须是硬失败：缺字形时浏览器**不报错**，只是静默回退到访客本机字体，
 * 于是衬线标题里混进宋体。线上没人能发现，只能靠人拿 CDP 抽查字形来源
 * （HANDOFF「工具链里的静默失败清单」第 4 条）。这里把它变成退出码。
 *
 * 扫描范围刻意收在 `content/`：那是**会持续增长**、也正是历史上出事的地方
 * （新增文章引入新字）。站点 chrome 的文案（lib/site-content.ts、页面里的
 * 中文字面量）没纳入，因为那些文件里大量中文出现在**注释**中，粗暴取字会制造
 * 假失败——假失败比漏报更能毁掉一个检查。已知边界，见 lib/glyph-coverage.ts。
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { checkGlyphCoverage } from '../lib/glyph-coverage.ts';

const CSS_FILE = 'app/globals.css';
const CONTENT_DIR = 'content';

const css = readFileSync(CSS_FILE, 'utf8');

const sources = readdirSync(CONTENT_DIR, { recursive: true, encoding: 'utf8' })
  .map((entry) => entry.split(path.sep).join('/'))
  .filter((entry) => entry.endsWith('.md'))
  .sort()
  .map((relative) => {
    const full = path.join(CONTENT_DIR, relative);
    return { path: full.split(path.sep).join('/'), text: readFileSync(full, 'utf8') };
  });

const report = checkGlyphCoverage(css, sources);

if (report.rangeCount === 0) {
  console.error(
    `✗ 字形覆盖检查无法进行：${CSS_FILE} 里没有解析到任何 unicode-range。\n` +
      '  split-fonts.py 写的 @font-face 块可能缺失或被破坏（先跑 npm run check:css 看结构自检）。\n',
  );
  process.exit(1);
}

if (report.missing.length > 0) {
  const total = report.missing.reduce((sum, item) => sum + item.chars.length, 0);
  console.error(
    `✗ 字形覆盖检查失败：${total} 个字在字体分片里没有声明（扫描 ${sources.length} 个内容文件）。\n`,
  );
  for (const item of report.missing) {
    console.error(`  ${item.path}`);
    console.error(`    缺字：${item.chars.join(' ')}`);
  }
  console.error(
    '\n  这些字浏览器不会报错，只会静默回退到访客本机字体（衬线标题里混进宋体）。\n' +
      '  修复：\n' +
      '    1. python subset-fonts.py    # 从源 OTF 重出整包子集，写入 fonts-src/\n' +
      '    2. npm run fonts             # 重切分片，并直接改写 app/globals.css 的 @font-face 块\n' +
      '    3. npm run build             # 复验\n' +
      '  前置条件（源 OTF 与 NOTO_SRC_DIR）见 subset-fonts.py 文件头。\n',
  );
  process.exit(1);
}

console.log(
  `✓ 字形覆盖检查通过（${sources.length} 个内容文件 / ${report.rangeCount} 个分片 / 并集 ${report.coveredCount} 个码位，无缺字）`,
);
