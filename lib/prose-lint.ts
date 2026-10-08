/**
 * 中文文案门禁：读者可见文案的最小排版规范（content 目录下的 Markdown）。
 *
 * 为什么自己写而不引 lint 库：规则只有三条，全都是这个站自己吃过的亏
 * （正文是中文排版的主题，文案自己不能破例）；自带的白名单控制也比
 * 通用工具好收敛。分层依据与 css-integrity 相同——纯函数可测，
 * 文件 IO 留给 scripts/check-prose.ts。
 *
 * 三条规则（宁可漏报，不可误报）：
 *  cjk-latin-space    中英/数字之间要有空格（「读完4篇」→「读完 4 篇」）
 *  punct-space-before 全角标点之前不留空格（「 okay ，」→「okay，」）
 *  cjk-ascii-punct    中文句子不用半角标点（「前端,后端」→「前端，后端」）
 *
 * 检查前先剥掉围栏代码块、行内代码、链接 URL 与裸链接——代码与地址
 * 不是文案，按中文排版规则去要求它们只会产出噪音。
 */

export type ProseFinding = {
  line: number;
  rule: string;
  message: string;
  snippet: string;
};

const CJK = '\\u4e00-\\u9fff';

/** 按行保留的剥除：围栏块/图片/链接 URL/行内代码/裸链接。
    行内代码剥壳留字（渲染出来它也是正文的一部分，同样受排版规范约束）。 */
export function stripProseNoise(raw: string): string {
  return (
    raw
      // 围栏代码块：整块抹掉，但按行数保留换行，行号不漂移
      .replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, (match) =>
        '\n'.repeat(match.split('\n').length - 1),
      )
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      // 链接：文字留下，URL 抹掉
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // frontmatter 的数组字面量（tags: [前端, 性能]）是数据语法不是文案，
      // 里面的半角逗号属于解析器，不归排版规则管
      .replace(/^(\s*[\w-]+:\s*)\[.*?\]\s*$/gm, '$1')
      // 裸链接与尖括号链接
      .replace(/<?https?:\/\/\S+>?/g, ' ')
      // 行内代码：剥壳留字
      .replace(/`([^`]*)`/g, '$1')
  );
}

type Rule = {
  code: string;
  message: string;
  pattern: RegExp;
};

const RULES: Rule[] = [
  {
    code: 'cjk-latin-space',
    message: '中英文/数字之间要有空格',
    pattern: new RegExp(
      `([${CJK}])([A-Za-z0-9])|([A-Za-z0-9])([${CJK}])`,
    ),
  },
  {
    code: 'punct-space-before',
    message: '全角标点之前不留空格',
    pattern: / [，。；：！？、」』）]/,
  },
  {
    code: 'cjk-ascii-punct',
    message: '中文句子应使用全角标点（，。；：！？）',
    pattern: new RegExp(`[${CJK}][,.:;?!](?![0-9])`),
  },
];

/** 逐行检查；返回全部发现。frontmatter（--- 包裹的头部）不豁免——
    title/description 同样是读者可见文案。 */
export function lintProse(raw: string): ProseFinding[] {
  const text = stripProseNoise(raw);
  const findings: ProseFinding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      const match = rule.pattern.exec(line);
      if (match) {
        findings.push({
          line: index + 1,
          rule: rule.code,
          message: rule.message,
          snippet: line.trim().slice(0, 60),
        });
      }
    }
  });
  return findings;
}
