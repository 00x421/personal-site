/**
 * 内容解析的纯函数层。
 *
 * 这一层刻意保持**零依赖**：不 import marked / prismjs，也不碰 `import.meta.glob`，
 * 所以能在纯 Node 下直接跑 `node --test` 验证（见 tests/content-parse.test.ts）。
 * `lib/markdown.ts` 与 `data/books.ts` 都建立在它之上——书籍的 frontmatter 曾经
 * 自己实现了一份解析器，两处行为会悄悄漂移，现在统一从这里取。
 */

/** frontmatter 的原始键值：字符串，或空值后跟随的 “- 条目” 块列表。 */
export type RawFrontmatter = Record<string, string | string[]>;

/** 去掉 YAML 风格的包裹引号：`year: '2026'` 与 `year: 2026` 应等价。
    只处理首尾成对的引号，`it's` 这类内含引号的值不受影响。 */
export function unquote(value: string): string {
  return /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
}

/** 拆出 `---` 包裹的 frontmatter 与正文。缺少 frontmatter 时返回空 data 和完整原文。
    结尾的换行是可选的，因此只有 frontmatter 的文件也能正确解析。 */
export function splitFrontmatter(raw: string): { data: RawFrontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };

  const data: RawFrontmatter = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const idx = lines[i].indexOf(':');
    if (idx === -1) continue;
    const key = lines[i].slice(0, idx).trim();
    const value = lines[i].slice(idx + 1).trim();
    if (!key) continue;

    if (value) {
      data[key] = unquote(value);
    } else {
      // 空值后跟随缩进的 “- 条目” 块列表
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        i += 1;
        items.push(unquote(lines[i].replace(/^\s*-\s+/, '').trim()));
      }
      if (items.length) data[key] = items;
    }
  }
  return { data, body: raw.slice(match[0].length) };
}

/** 取单个字符串字段。空串视为缺失（frontmatter 里 `series:` 等价于不写）。 */
export function readString(data: RawFrontmatter, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value ? value : undefined;
}

/** 取列表字段。兼容三种写法：块列表、`[a, b]` 行内数组、逗号分隔的裸字符串。 */
export function parseList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => unquote(item.trim()))
    .filter(Boolean);
}

/** `parseList` 的取值入口。 */
export function readList(data: RawFrontmatter, key: string): string[] {
  return parseList(data[key]);
}

/** 去掉 HTML 注释后判断正文是否为空（注释不构成案例内容）。 */
export function stripComments(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, '');
}

/** 去掉 Markdown 语法噪音后按字符数估算阅读时长（中文约 400 字/分钟）。 */
export function estimateReadTime(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\S\n]+/g, ''))
    .replace(/[#>*`~_[\]()!|-]/g, '');
  return `${Math.max(1, Math.ceil(text.length / 400))} min read`;
}

/** XML 文本转义（RSS / sitemap 用）。`&` 必须最先替换，否则会二次转义后续实体。 */
export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
