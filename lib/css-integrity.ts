/**
 * `app/globals.css` 的结构断言。
 *
 * 为什么需要：这个项目**四次**踩到「不报错但也没生效」的坑，其中两次的载体
 * 都是这份样式表，而两次的症状都是「整块 CSS 变量消失」：
 *
 *   a) 脚本收尾文本混进样式表，压缩后与 `:root` 拼成选择器 `DONE :root`，
 *      匹配不到任何元素 —— 于是 `--noise-opacity`、`--paper` 全部失效
 *      （满屏颗粒、背景透明），线上故障。
 *   b) 明暗主题的配色「只写了一半」（如 `.mail-button[data-copied]` 在暗色下
 *      黑底黑字 1.03:1、`.project-card.lime` 暗色下浅字压亮黄绿 1.70:1）。
 *
 * 这两种错误都不会让构建失败、不会进 console，只能靠「人看一眼截图」发现。
 * 这个模块把它们变成**可断言的字符串性质**，于是能进 CI。
 *
 * 纯字符串函数、零依赖 —— 可在 `node --test` 下直接跑（见
 * `tests/css-integrity.test.ts`）。文件读写留在 `scripts/check-css-integrity.ts`。
 */

export type Finding = {
  /** error 让构建失败；warn 只提示。 */
  level: 'error' | 'warn';
  code: string;
  message: string;
};

/** 字体分片块的标记，由 split-fonts.py 直接改写其间内容。 */
const FONT_FACES_START = '/* @font-faces:start */';
const FONT_FACES_END = '/* @font-faces:end */';

const DARK_SELECTOR = "[data-theme='dark']";

/**
 * 允许只在 `:root` 定义、不在暗色主题里重定义的变量。
 *
 * 这份名单必须是**穷尽且每条都有理由**的。往里加东西之前先问：它真的与明暗
 * 无关吗？如果只是「暗色下忘了写」，那正是本模块要抓的 bug。
 */
const THEME_INDEPENDENT = new Set([
  // 标题字距是排版常量，不随明暗变化。
  '--tracking-cjk-display',
  '--tracking-cjk-heading',
  // 画芯是「墨画在真纸上」——纸在暗色主题里仍然是纸，所以这个色刻意不反转。
  // （观感已验证：深色画板 + 纸白画芯，是刻意的物理质感，不是漏写。）
  '--portrait-paper',
]);

/**
 * `:root` 必须定义的语义变量。
 *
 * 用途是检测「整块变量被丢弃」——光靠「:root 非空」不够：如果两个主题块
 * 一起被清空，成对性检查会真空通过。这些名字是页面渲染的硬依赖。
 */
const REQUIRED_ROOT_TOKENS = [
  '--ink',
  '--paper',
  '--line',
  '--violet',
  '--muted',
  '--raised',
  '--body-text',
  '--card-ink',
  '--card-ink-text',
  '--noise-opacity',
] as const;

/** 去掉 CSS 注释（不处理字符串字面量：本文件里没有含 `/*` 的字符串值）。 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 取出某个选择器的声明块内容；选择器必须位于行首（CSS 里的写法约定）。 */
function blockOf(css: string, selector: string): string | null {
  const match = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm').exec(
    css,
  );
  return match ? match[1] : null;
}

/** 声明块里出现的自定义属性名。 */
function customProps(declarations: string): Set<string> {
  return new Set(
    [...declarations.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]),
  );
}

/**
 * 断言 a：字体分片块内**只有** `@font-face`、注释与空白。
 *
 * 这是历史上那次线上故障的直接检测器 —— 当时脚本的收尾文本（`DONE`）被
 * 写进了这个区域，压缩后与紧随其后的 `:root` 拼成选择器而整块失效。
 * 只要区域里出现任何别的字符，就说明「脚本直接改写」的约定被破坏了。
 */
function checkFontFaceRegion(css: string): Finding[] {
  const start = css.indexOf(FONT_FACES_START);
  const end = css.indexOf(FONT_FACES_END);

  if (start === -1 || end === -1) {
    return [
      {
        level: 'error',
        code: 'font-faces-marker-missing',
        message: `缺少 ${start === -1 ? FONT_FACES_START : FONT_FACES_END} 标记。这个标记是 split-fonts.py 直接改写样式表的锚点，删掉它脚本会失效（或写入错误位置）。`,
      },
    ];
  }
  if (end < start) {
    return [
      {
        level: 'error',
        code: 'font-faces-marker-order',
        message: `${FONT_FACES_END} 出现在 ${FONT_FACES_START} 之前，脚本改写的区间没有意义。`,
      },
    ];
  }

  const region = css.slice(start + FONT_FACES_START.length, end);
  const residue = stripComments(region.replace(/@font-face\s*\{[^}]*\}/g, '')).trim();

  if (residue) {
    return [
      {
        level: 'error',
        code: 'font-faces-region-polluted',
        message:
          `字体分片区（${FONT_FACES_START} 与 ${FONT_FACES_END} 之间）出现了 @font-face 之外的文本：` +
          `${JSON.stringify(residue.slice(0, 120))}。` +
          '这正是 2026-09 那次线上故障的形态：脚本收尾文本被写进样式表，压缩后与相邻选择器拼接，导致整块 CSS 变量失效。' +
          '该区域只能由 split-fonts.py 写入 @font-face。',
      },
    ];
  }
  return [];
}

/**
 * 断言 b：`:root` 定义了必需的语义变量。
 *
 * 检测「整块变量被丢弃」。成对性检查（断言 c）单独不足以覆盖这种情况：
 * 两个主题块一起被清空时它会真空通过。
 */
function checkRootTokens(css: string): Finding[] {
  const declarations = blockOf(stripComments(css), ':root');
  if (declarations === null) {
    return [
      {
        level: 'error',
        code: 'root-block-missing',
        message:
          '找不到 `:root { ... }` 声明块。全站配色变量都定义在这里，缺失会让页面配色整体失效' +
          '（历史故障形态：脚本输出与 `:root` 拼成了 `DONE :root`，匹配不到元素）。',
      },
    ];
  }

  const defined = customProps(declarations);
  const missing = REQUIRED_ROOT_TOKENS.filter((token) => !defined.has(token));
  if (missing.length > 0) {
    return [
      {
        level: 'error',
        code: 'root-tokens-missing',
        message: `:root 缺少必需变量：${missing.join('、')}。整块变量可能被误删或被选择器拼接破坏。`,
      },
    ];
  }
  return [];
}

/**
 * 断言 c：明暗主题成对定义。
 *
 * 这是这个项目**最高频**的配色 bug：`--ink` / `--paper`、`--card-ink` /
 * `--card-ink-text`、`--tone-violet` / `--tone-violet-ink` 这类变量必须成对
 * 覆盖，只写一半就会在某个主题下变成看不清的组合（实测过 1.03:1 与 1.70:1）。
 * 例外必须显式登记在 THEME_INDEPENDENT 里并写明理由。
 */
function checkThemePairing(css: string): Finding[] {
  const stripped = stripComments(css);
  const rootDeclarations = blockOf(stripped, ':root');
  const darkDeclarations = blockOf(stripped, DARK_SELECTOR);

  if (rootDeclarations === null) return []; // 已由断言 b 报出，不重复
  if (darkDeclarations === null) {
    return [
      {
        level: 'error',
        code: 'dark-theme-missing',
        message: `找不到 ${DARK_SELECTOR} 声明块 —— 暗色主题整体缺失。`,
      },
    ];
  }

  const root = customProps(rootDeclarations);
  const dark = customProps(darkDeclarations);

  const unpaired = [...root].filter(
    (token) => !dark.has(token) && !THEME_INDEPENDENT.has(token),
  );
  const findings: Finding[] = [];
  if (unpaired.length > 0) {
    findings.push({
      level: 'error',
      code: 'theme-token-unpaired',
      message:
        `这些变量只在 :root 定义，暗色主题没有覆盖：${unpaired.join('、')}。` +
        '配色必须成对给出——只写一半会在某一主题下变成低对比组合（曾实测出 1.03:1 与 1.70:1 的隐形文字）。' +
        '若某个变量确实与明暗无关，请把它加进 lib/css-integrity.ts 的 THEME_INDEPENDENT 并写明理由。',
    });
  }

  const orphans = [...dark].filter((token) => !root.has(token));
  if (orphans.length > 0) {
    findings.push({
      level: 'warn',
      code: 'theme-token-orphan',
      message: `这些变量只在暗色主题定义，:root 没有：${orphans.join('、')}。亮色主题下会取不到值。`,
    });
  }
  return findings;
}

/**
 * 断言 d：token 块之外不出现裸色值。
 *
 * 项目自己的排查建议就是 grep 这个；把它固化成断言后，就不用依赖人记得 grep。
 * 裸色值的麻烦在于它**不参与主题切换**：写在某个规则里就等于写死了一个主题
 * （`.portrait-media` 的 `background: #f6f2e8` 就是这样漏出来的，已在本次修复
 * 中提升为 `--portrait-paper`）。
 *
 * 只检查十六进制颜色；`rgb()`/`hsl()` 里常见的阴影透明度（如
 * `rgb(0 0 0 / 0.08)`）是刻意的主题中性值，不在此列。
 */
function checkBareColors(css: string): Finding[] {
  let scannable = stripComments(css);
  for (const selector of [':root', DARK_SELECTOR]) {
    const declarations = blockOf(scannable, selector);
    if (declarations !== null) {
      scannable = scannable.replace(
        new RegExp(
          `^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`,
          'm',
        ),
        '',
      );
    }
  }

  const offenders: string[] = [];
  const declarations = scannable.matchAll(
    /(?:^|[{;])\s*([a-z-]+)\s*:\s*([^;{}]*#[0-9a-fA-F]{3,8}[^;{}]*)/g,
  );
  for (const [, property, value] of declarations) {
    offenders.push(`${property}: ${value.trim().slice(0, 60)}`);
  }

  if (offenders.length === 0) return [];
  return [
    {
      level: 'error',
      code: 'bare-color-literal',
      message:
        `token 块之外出现裸色值（不会跟随明暗主题切换）：\n    - ${offenders.join('\n    - ')}` +
        '\n  请提升为 :root / [data-theme=\'dark\'] 里的成对变量。',
    },
  ];
}

/** 依次跑完全部断言，收集所有发现（不早退，便于一次看到所有问题）。 */
export function checkGlobalsCss(css: string): Finding[] {
  return [
    ...checkFontFaceRegion(css),
    ...checkRootTokens(css),
    ...checkThemePairing(css),
    ...checkBareColors(css),
  ];
}

export const cssIntegrityRules = {
  FONT_FACES_START,
  FONT_FACES_END,
  DARK_SELECTOR,
  THEME_INDEPENDENT,
  REQUIRED_ROOT_TOKENS,
} as const;
