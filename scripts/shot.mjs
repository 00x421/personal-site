#!/usr/bin/env node
/**
 * 截图取证：转发到 oil-ui skill 的 `scripts/shoot.mjs`。
 *
 * 为什么不在仓库里 vendor 一份：shoot.mjs 只用 Node 内置模块 + 本机 Chrome
 * （无需 Playwright），但会随 skill 升级。这里只补项目默认值并转发参数，
 * 升级 skill 即升级工具；CI 不依赖它（CI 没有安装 skill，也不会跑到这里）。
 *
 * 用法：
 *   npm run shot -- http://localhost:3000/ --size desktop,mobile
 *   npm run shot -- http://localhost:3000/ --selector ".cta"
 *   npm run shot -- http://localhost:3000/articles/x --steps "click .article-toc-mobile summary"
 *
 * 默认值：--root 指向仓库根，--out 指向 .oil-shots/（已在 .gitignore）。
 * 完整选项见 `node ~/.claude/skills/oil-ui/scripts/shoot.mjs --help`。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const candidates = [
  process.env.OIL_UI_SKILL_DIR,
  path.join(homedir(), '.claude', 'skills', 'oil-ui'),
  path.join(homedir(), '.agents', 'skills', 'oil-ui'),
].filter(Boolean);

const skillDir = candidates.find((dir) =>
  existsSync(path.join(dir, 'scripts', 'shoot.mjs')),
);

if (!skillDir) {
  console.error(
    '找不到 oil-ui skill。先安装：\n' +
      '  npx skills add oil-oil/oil-ui --agent pi -g -y\n' +
      '装完 skill 在 ~/.agents/skills/oil-ui，可复制到 ~/.claude/skills/。',
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.error(
    '用法：npm run shot -- <地址或 HTML 文件> [shoot.mjs 选项]\n' +
      '例：  npm run shot -- http://localhost:3000/ --size desktop,mobile --out .oil-shots/home\n' +
      '      npm run shot -- http://localhost:3000/ --selector ".cta"\n' +
      '      npm run shot -- http://localhost:3000/ --mask --mark "1=.project-card"',
  );
  if (args.length === 0) process.exit(1);
}

const defaults = [];
if (!args.includes('--root')) defaults.push('--root', process.cwd());
if (!args.includes('--out')) {
  defaults.push('--out', path.join(process.cwd(), '.oil-shots'));
}

const result = spawnSync(
  process.execPath,
  [path.join(skillDir, 'scripts', 'shoot.mjs'), ...defaults, ...args],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
