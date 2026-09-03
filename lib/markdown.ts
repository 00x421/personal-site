import { marked } from 'marked';

export type Article = {
  slug: string;
  title: string;
  description: string;
  published: string;
  readTime: string;
  tags: string[];
  draft: boolean;
  /** marked 渲染后的正文 HTML（站点内容为第一方撰写，无需消毒） */
  html: string;
};

type RawFrontmatter = Record<string, string>;

function splitFrontmatter(raw: string): { data: RawFrontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return { data: {}, body: raw };
  const data: RawFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

function parseTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** 去掉 Markdown 语法噪音后按字符数估算阅读时长（中文约 400 字/分钟）。 */
function calcReadTime(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\S\n]+/g, ''))
    .replace(/[#>*`~_[\]()!|-]/g, '');
  return `${Math.max(1, Math.ceil(text.length / 400))} min read`;
}

export function buildArticle(slug: string, raw: string): Article {
  const { data, body } = splitFrontmatter(raw);
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    published: data.published ?? '',
    readTime: calcReadTime(body),
    tags: parseTags(data.tags),
    draft: data.draft === 'true',
    html: marked.parse(body, { async: false, gfm: true }),
  };
}
