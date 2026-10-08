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
  unique,
} from './content-parse.ts';

// 代码块 → 带 data-lang 的 pre；语言标签与复制按钮由客户端增强组件接管。
// 表格 → 包一层可横向滚动容器（宽表在窄容器里会挤成一团；服务端处理，无需 JS）。
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

export type TocEntry = { id: string; text: string; depth: 2 | 3 };

/** 给 h2/h3 注入锚点 id（h2-0 / h3-1 …按出现序号），并返回目录树。
    在构建期一次性完成（html 是构建产物），序号在单篇文档内稳定。
    标题内可能含 <code> 等内联标记——目录文本剥掉标签留纯文字。 */
function injectHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const counters = { 2: 0, 3: 0 } as Record<2 | 3, number>;
  const out = html.replace(
    /<h([23])>([\s\S]*?)<\/h\1>/g,
    (_match, depthStr: string, inner: string) => {
      const depth = Number(depthStr) as 2 | 3;
      const id = `h${depth}-${counters[depth]++}`;
      toc.push({ id, text: inner.replace(/<[^>]+>/g, '').trim(), depth });
      return `<h${depth} id="${id}">${inner}</h${depth}>`;
    },
  );
  return { html: out, toc };
}

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
  /** marked 渲染后的正文 HTML（站点内容为第一方撰写，无需消毒），h2/h3 已带锚点 id */
  html: string;
  /** 正文目录（h2/h3），文章页 TOC 用 */
  toc: TocEntry[];
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
  /** 案例正文目录（h2/h3），案例页 TOC 用 */
  toc: TocEntry[];
  /** 正文为空 → 仅首页卡片；写了正文即生成 /projects/{slug} 案例页 */
  hasCase: boolean;
  /** 预留位置：true 时首页、案例页、sitemap 全部不出现 */
  draft: boolean;
};

export function buildArticle(slug: string, raw: string): Article {
  const { data, body } = splitFrontmatter(raw);
  const { html, toc } = injectHeadingIds(marked.parse(body, { async: false, gfm: true }));
  return {
    slug,
    title: readString(data, 'title') ?? slug,
    description: readString(data, 'description') ?? '',
    published: readString(data, 'published') ?? '',
    readTime: estimateReadTime(body),
    // 去重在解析层做：标签云、RSS 的 category、搜索索引
    // 都读同一个 tags 数组，在这里收敛就不会各处漏一处。
    tags: unique(parseList(data.tags)),
    series: readString(data, 'series'),
    draft: readString(data, 'draft') === 'true',
    html,
    toc,
  };
}

export function buildProject(slug: string, raw: string): Project {
  const { data, body } = splitFrontmatter(raw);
  // 注释不构成案例内容：先去注释再看还有没有正文。
  const content = stripComments(body).trim();
  const hasCase = content.length > 0;
  const type = readString(data, 'type') ?? '';
  const tone = readString(data, 'tone');
  const { html, toc } = hasCase
    ? injectHeadingIds(marked.parse(stripComments(body), { async: false, gfm: true }))
    : { html: '', toc: [] as TocEntry[] };
  return {
    slug,
    title: readString(data, 'title') ?? slug,
    type,
    year: readString(data, 'year') ?? '',
    summary: readString(data, 'summary') ?? '',
    tags: unique(parseList(data.tags)),
    tone: tone === 'violet' || tone === 'lime' ? tone : 'ink',
    mark: readString(data, 'mark') ?? '00',
    order: Number(readString(data, 'order') ?? NaN) || 99,
    status: readString(data, 'status') ?? (hasCase ? '查看案例' : '案例整理中'),
    eyebrow: readString(data, 'eyebrow') ?? 'CASE STUDY',
    meta: readList(data, 'meta').length > 0 ? readList(data, 'meta') : [type],
    deliverables: readList(data, 'deliverables'),
    html,
    toc,
    hasCase,
    draft: readString(data, 'draft') === 'true',
  };
}
