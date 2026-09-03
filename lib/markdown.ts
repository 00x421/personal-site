import { marked } from 'marked';
// .ts 扩展名让 scripts/generate-og.ts 在纯 Node ESM 下也能解析（Vite 同样支持）。
import { highlightCode } from './highlight.ts';

// 代码块 → 带 data-lang 的 pre；语言标签与复制按钮由客户端增强组件接管。
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase() || 'text';
      return `<pre data-lang="${language}"><code>${highlightCode(text, language === 'text' ? undefined : language)}</code></pre>`;
    },
  },
});

export type Article = {
  slug: string;
  title: string;
  description: string;
  published: string;
  readTime: string;
  tags: string[];
  /** 所属系列名；同系列文章在详情页互相导航。 */
  series?: string;
  draft: boolean;
  /** marked 渲染后的正文 HTML（站点内容为第一方撰写，无需消毒） */
  html: string;
};

export type Project = {
  slug: string;
  title: string;
  type: string;
  year: string;
  summary: string;
  tags: string[];
  /** 卡片配色变体：ink / violet / lime */
  tone: 'ink' | 'violet' | 'lime';
  /** 卡片右下角装饰符号 */
  mark: string;
  /** 首页排序权重，小者在前 */
  order: number;
  status: string;
  /** 案例页眉标 */
  eyebrow: string;
  /** 案例页 hero 下方徽章组 */
  meta: string[];
  /** 案例页尾部自动渲染的交付物徽章 */
  deliverables: string[];
  html: string;
  /** 正文为空 → 仅首页卡片；写了正文即生成 /projects/{slug} 案例页 */
  hasCase: boolean;
};

type RawFrontmatter = Record<string, string | string[]>;

function splitFrontmatter(raw: string): { data: RawFrontmatter; body: string } {
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
      data[key] = value;
    } else {
      // 空值后跟随缩进的 “- 条目” 块列表
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        i += 1;
        items.push(lines[i].replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
      }
      if (items.length) data[key] = items;
    }
  }
  return { data, body: raw.slice(match[0].length) };
}

function str(data: RawFrontmatter, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' && value ? value : undefined;
}

function list(data: RawFrontmatter, key: string): string[] {
  const value = data[key];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string' || !value) return [];
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function parseTags(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** 去掉 HTML 注释后判断正文是否为空（注释不构成案例内容）。 */
function stripComments(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, '');
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
    title: str(data, 'title') ?? slug,
    description: str(data, 'description') ?? '',
    published: str(data, 'published') ?? '',
    readTime: calcReadTime(body),
    tags: parseTags(data.tags),
    series: str(data, 'series'),
    draft: str(data, 'draft') === 'true',
    html: marked.parse(body, { async: false, gfm: true }),
  };
}

export function buildProject(slug: string, raw: string): Project {
  const { data, body } = splitFrontmatter(raw);
  const content = stripComments(body).trim();
  const hasCase = content.length > 0;
  const type = str(data, 'type') ?? '';
  const tone = str(data, 'tone');
  return {
    slug,
    title: str(data, 'title') ?? slug,
    type,
    year: str(data, 'year') ?? '',
    summary: str(data, 'summary') ?? '',
    tags: parseTags(data.tags),
    tone: tone === 'violet' || tone === 'lime' ? tone : 'ink',
    mark: str(data, 'mark') ?? '00',
    order: Number(str(data, 'order') ?? NaN) || 99,
    status: str(data, 'status') ?? (hasCase ? '查看案例' : '案例整理中'),
    eyebrow: str(data, 'eyebrow') ?? 'CASE STUDY',
    meta: list(data, 'meta').length > 0 ? list(data, 'meta') : [type],
    deliverables: list(data, 'deliverables'),
    html: hasCase ? marked.parse(stripComments(body), { async: false, gfm: true }) : '',
    hasCase,
  };
}
