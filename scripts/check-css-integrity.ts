/**
 * `app/globals.css` 的结构自检（构建前跑，见 package.json 的 check 脚本）。
 *
 * 断言的逻辑在 `lib/css-integrity.ts`（纯函数，有单测）；这里只负责读文件、
 * 打印、决定退出码。之所以做成构建门禁而不是「记得手动 grep」：这个项目两次
 * 样式表事故都是**不报错但整块失效**，人的注意力抓不住它，字符串断言能。
 *
 *   node --experimental-strip-types scripts/check-css-integrity.ts
 */
import { readFileSync } from 'node:fs';
import { checkGlobalsCss } from '../lib/css-integrity.ts';

const TARGET = 'app/globals.css';

const css = readFileSync(TARGET, 'utf8');
const findings = checkGlobalsCss(css);

const errors = findings.filter((finding) => finding.level === 'error');
const warnings = findings.filter((finding) => finding.level === 'warn');

for (const finding of warnings) {
  console.warn(`⚠ ${TARGET} [${finding.code}] ${finding.message}`);
}

if (errors.length > 0) {
  console.error(`✗ ${TARGET} 结构自检失败（${errors.length} 项）：\n`);
  for (const finding of errors) {
    console.error(`  [${finding.code}] ${finding.message}\n`);
  }
  console.error(
    '  这些断言存在的理由见 lib/css-integrity.ts 头部：两次线上样式表事故都是\n' +
      '  「不报错但整块 CSS 变量失效」，只能靠字符串性质拦住。\n',
  );
  process.exit(1);
}

console.log(
  `✓ ${TARGET} 结构自检通过（字体分片区纯净 / :root 必需变量齐全 / 明暗主题成对 / 无裸色值）`,
);
