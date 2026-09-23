/**
 * 字形覆盖检查：**内容用字 ⊆ 字体分片声明的 unicode-range**。
 *
 * 为什么需要（ROADMAP「可加的自动检查」里一直没做的那条）：新增文章引入一个
 * 字集外的字时，浏览器不会报错——它会**静默回退到访客本机字体**，于是页面出现
 * 字形混搭（衬线标题里混进宋体/黑体）。这是这个项目第四次踩到的同形态坑：
 * 不报错、不测量就发现不了，只能靠 CDP 的 `CSS.getPlatformFontsForNode` 抽查。
 *
 * 检查打在**进 git 的产物**上：`app/globals.css` 里由 `split-fonts.py` 写出的
 * `unicode-range`（31 个分片的并集），而不是 `fonts-src/` 里的中间字体——
 * 后者在 .gitignore 里，CI 拿不到。
 *
 * 关于「为什么读 CSS 而不是解析 woff2 的 cmap」：woff2 的表是逐表 brotli 压缩
 * 且不记录各表压缩后长度，在 Node 里定位 cmap 需要自己实现流式 brotli 边界探测，
 * 成本远高于收益。而 `unicode-range` 与 woff2 是 `split-fonts.py` **同一次运行
 * 里由同一个字符集合产出**的，两者耦合；再加上脚本自带「分片码位不得相交」的
 * 自检，这里的并集就已经是可信的覆盖声明。
 *
 * ⚠️ 已知边界：本检查验证的是**声明**的覆盖，不是 woff2 字节里的实际 cmap。
 * 若将来要更硬的保证，应在 `split-fonts.py` 侧用 fontTools 断言两者的并集一致
 * （Python 侧有 fontTools，读 cmap 是现成的）。
 *
 * 纯函数、零依赖，可在 `node --test` 下直接跑（见 tests/glyph-coverage.test.ts）。
 */

import { cssIntegrityRules } from './css-integrity.ts';

/** 缺失字符按文件归集。`chars` 已去重并按码位升序。 */
export type GlyphCoverageReport = {
  /** unicode-range 并集的码位数量。 */
  coveredCount: number;
  /** 解析到的 unicode-range 条数（一个分片一条）。 */
  rangeCount: number;
  /** 有缺失的文件；全部覆盖时为空数组。 */
  missing: { path: string; chars: string[] }[];
};

/**
 * 是否属于「字体应当覆盖」的码位。
 *
 * **刻意只覆盖 CJK 相关区块**，不是「所有非 ASCII」：emoji、箭头、数学符号这类
 * 字符永远由访客系统的 emoji/符号字体提供，Noto Serif SC 里本来就不该有它们。
 * 把它们算进来只会制造假失败——而假失败会让维护者开始忽略这个检查。
 * （实测站内用到的 → ↑ ≈ ≤ ⚠ ✓ 等符号确实已在分片里，但那是分片额外收录的结果，
 * 不是本检查的要求。）
 */
export function isRequiredCodepoint(codepoint: number): boolean {
  return (
    // CJK 统一表意文字
    (codepoint >= 0x4e00 && codepoint <= 0x9fff) ||
    // CJK 扩展 A
    (codepoint >= 0x3400 && codepoint <= 0x4dbf) ||
    // CJK 兼容表意文字
    (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
    // CJK 符号与标点（、。「」《》等）
    (codepoint >= 0x3000 && codepoint <= 0x303f) ||
    // 半角与全角形式（，。！？：；（）等）
    (codepoint >= 0xff00 && codepoint <= 0xffef)
  );
}

/** 从声明块里取出的码位集合，以及解析到的 range 条数。 */
function parseRanges(declarations: string): { covered: Set<number>; rangeCount: number } {
  const covered = new Set<number>();
  let rangeCount = 0;

  for (const match of declarations.matchAll(/unicode-range\s*:\s*([^;]+);/g)) {
    rangeCount += 1;
    for (const part of match[1].split(',')) {
      // CSS 规范里 U+ 前缀大小写不敏感，两种都收。
      const single = /^\s*[Uu]\+([0-9A-Fa-f]{1,6})\s*$/.exec(part);
      const span = /^\s*[Uu]\+([0-9A-Fa-f]{1,6})-([0-9A-Fa-f]{1,6})\s*$/.exec(part);
      if (single) {
        covered.add(parseInt(single[1], 16));
      } else if (span) {
        const start = parseInt(span[1], 16);
        const end = parseInt(span[2], 16);
        for (let cp = start; cp <= end; cp += 1) covered.add(cp);
      }
      // 无法解析的片段直接跳过：CSS 结构问题由 lib/css-integrity.ts 负责报错。
    }
  }
  return { covered, rangeCount };
}

/**
 * 只取字体分片区里的 unicode-range。
 *
 * 限定区域很重要：页面上别处若出现 unicode-range（未来可能给别的字体加），
 * 它的字符集不该被算成 Noto Serif SC 的覆盖。
 */
function coveredCodepoints(css: string): { covered: Set<number>; rangeCount: number } {
  const start = css.indexOf(cssIntegrityRules.FONT_FACES_START);
  const end = css.indexOf(cssIntegrityRules.FONT_FACES_END);
  if (start === -1 || end === -1 || end < start) {
    return { covered: new Set(), rangeCount: 0 };
  }
  return parseRanges(css.slice(start, end));
}

/** 正文里出现、且属于必需码位的字符集合（去重）。 */
function requiredCodepoints(text: string): Set<number> {
  const required = new Set<number>();
  for (const char of text) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined && isRequiredCodepoint(codepoint)) required.add(codepoint);
  }
  return required;
}

/**
 * 检查一组源文件是否被字体分片完全覆盖。
 *
 * `sources` 由调用方读取（本层不碰文件系统），形如
 * `[{ path: 'content/articles/x.md', text: '...' }]`。
 */
export function checkGlyphCoverage(
  css: string,
  sources: { path: string; text: string }[],
): GlyphCoverageReport {
  const { covered, rangeCount } = coveredCodepoints(css);

  const missing: { path: string; chars: string[] }[] = [];
  for (const source of sources) {
    const absent = [...requiredCodepoints(source.text)]
      .filter((codepoint) => !covered.has(codepoint))
      .sort((a, b) => a - b)
      .map((codepoint) => String.fromCodePoint(codepoint));
    if (absent.length > 0) missing.push({ path: source.path, chars: absent });
  }

  return { coveredCount: covered.size, rangeCount, missing };
}
