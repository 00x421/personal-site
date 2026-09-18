import { marked } from 'marked';
// .ts 扩展名让 scripts/generate-og.ts 在纯 Node ESM 下也能解析（Vite 同样支持）。
import { highlightCode } from './highlight.ts';
import {
  estimateReadTime,
  parseList,
  readList,
  readString,
  splitFrontmatter,
  stripComments,
} from './content-parse.ts';

// 代码块 → 带 data-lang 的 pre；语言标签与复制按钮由客户端增强组件接管。
// 表格 → 包一层可横向滚动容器（宽表在窄屏会撑破正文栏；服务端处理，无需 JS）。
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = (lang ?? '').trim().split(/\s+/)[0].toLowerCase() || 'text';
      return `<pre data-lang="${language}"><code>${highlightCode(text, language === 'text' ? undefined : language)}</code></pre>`;
    },
    table(token: { header: unknown[]; rows: unknown[][] }) {
      const rendered = marked.Renderer.prototype.table.call(this, token as never);
      return `<div class="table-scroll">${rendered}</div>`;
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
  /** 预留位置：true 时首页、案例页、sitemap 全部不出现 */
  draft: boolean;
};

export function buildArticle(slug: string, raw: string): Article {
  const { data, body } = splitFrontmatter(raw);
  return {
    slug,
    title: readString(data, 'title') ?? slug,
    description: readString(data, 'description') ?? '',
    published: readString(data, 'published') ?? '',
    readTime: estimateReadTime(body),
    tags: parseList(data.tags),
    series: readString(data, 'series'),
    draft: readString(data, 'draft') === 'true',
    html: marked.parse(body, { async: false, gfm: true }),
  };
}

export function buildProject(slug: string, raw: string): Project {
  const { data, body } = splitFrontmatter(raw);
  // 注释不构成案例内容：先去注释再看还有没有正文。
  const content = stripComments(body).trim();
  const hasCase = content.length > 0;
  const type = readString(data, 'type') ?? '';
  const tone = readString(data, 'tone');
  return {
    slug,
    title: readString(data, 'title') ?? slug,
    type,
    year: readString(data, 'year') ?? '',
    summary: readString(data, 'summary') ?? '',
    tags: parseList(data.tags),
    tone: tone === 'violet' || tone === 'lime' ? tone : 'ink',
    mark: readString(data, 'mark') ?? '00',
    order: Number(readString(data, 'order') ?? NaN) || 99,
    status: readString(data, 'status') ?? (hasCase ? '查看案例' : '案例整理中'),
    eyebrow: readString(data, 'eyebrow') ?? 'CASE STUDY',
    meta: readList(data, 'meta').length > 0 ? readList(data, 'meta') : [type],
    deliverables: readList(data, 'deliverables'),
    html: hasCase ? marked.parse(stripComments(body), { async: false, gfm: true }) : '',
    hasCase,
    draft: readString(data, 'draft') === 'true',
  };
}
