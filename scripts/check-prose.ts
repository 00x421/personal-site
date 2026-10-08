/**
 * 中文文案门禁的文件入口（纯逻辑在 lib/prose-lint.ts，有单测）。
 *
 *   npm run check:prose
 *
 * 范围：content 目录下的 Markdown——读者可见的正文与 frontmatter 文案。
 * 刻意不扫 tsx/css：界面微文案另有 review 把关，那里混着代码与
 * 标识符，规则会大量误报，收不回来。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { lintProse } from '../lib/prose-lint.ts';

const TARGET = 'content';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk(TARGET);
let total = 0;
for (const file of files) {
  const findings = lintProse(readFileSync(file, 'utf8'));
  if (findings.length === 0) continue;
  total += findings.length;
  console.error(`\n✗ ${file}`);
  for (const finding of findings) {
    console.error(
      `  L${finding.line} [${finding.rule}] ${finding.message}\n    ${finding.snippet}`,
    );
  }
}

if (total > 0) {
  console.error(`\n文案门禁未通过：${total} 处（见上）。修文案，或先想清楚规则是否该豁免它。`);
  process.exit(1);
}

console.log(`✓ 文案门禁通过（${files.length} 个内容文件，中英空格/全角标点）`);
