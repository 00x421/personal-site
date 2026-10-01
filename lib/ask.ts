/**
 * 站内 AI 问答的纯函数层。
 *
 * 功能：访客向 GrokBot 提问，从站内文章/项目中检索相关片段，
 * 由 LLM 依据片段作答并附来源。分层依据与 content-parse 相同——
 * 这里的逻辑全部可在 node --test 下验证（tests/ask.test.ts）。
 *
 * 真实性条款：系统提示强制「只依据站内资料回答，没有就承认」，
 * 检索层也有最低相关度门槛——两道闸，防止 AI 替站长编造。
 */

export type AskChunk = {
  /** 引用定位：/articles/<slug>、/projects/<slug> 或 /books */
  slug: string;
  title: string;
  /** article | project | book | meta */
  kind: 'article' | 'project' | 'book' | 'meta';
  /** 所属小节标题；intro 表示正文引言 */
  heading: string;
  /** 纯文本（去 markdown 语法），切片上限见 MAX_CHUNK_CHARS */
  text: string;
};

/** 引用定位（route 与索引生成共用一份，别再各写一份）。 */
export function chunkPath(chunk: { kind: AskChunk['kind']; slug: string }): string {
  if (chunk.kind === 'article') return `/articles/${chunk.slug}`;
  if (chunk.kind === 'project') return `/projects/${chunk.slug}`;
  if (chunk.kind === 'book') return '/books';
  return '/';
}

export type IndexedChunk = AskChunk & { embedding: number[] };

export type AskIndex = {
  /** 构建期未配置向量 API 时为 false，路由据此整体关闭 */
  enabled: boolean;
  embedModel: string;
  chunks: IndexedChunk[];
};

/** 切片字符上限。bge-m3 上下文 8k token，1500 字约为其 1/4，
    保证「问题向量（短）↔ 片段向量（长）」的相似度不因片段过长被稀释。 */
export const MAX_CHUNK_CHARS = 1500;

/** 只剥围栏代码块（``` 或 ~~~，行首匹配；孤立闭合围栏单独剥掉）。
    必须在按 `## ` 切片**之前**调用：示例代码块内部常有「## 标题」字样，
    先切片会把它当成真实小节边界，产出假片段（how-this-site-is-built 实测）。 */
export function stripFences(raw: string): string {
  return raw
    .replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, ' ')
    .replace(/^~~~[^\n]*\n[\s\S]*?^~~~[^\n]*$/gm, ' ')
    .replace(/^```[^\n]*$/gm, ' ')
    .replace(/^~~~[^\n]*$/gm, ' ');
}

/** 去行内 markdown 语法噪音（链接/图片/强调/标题记号），保留正文文字（含 CJK）。 */
function stripInline(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 去掉全部 markdown 语法噪音，保留正文文字（含 CJK）。 */
export function stripMarkdown(raw: string): string {
  return stripInline(stripFences(raw));
}

/** 把一篇 markdown 正文按 `## ` 小节切片；首个小节之前的引言单独成片。
    切片**前**先剥围栏代码块（见 stripFences 的说明），
    超长小节按 MAX_CHUNK_CHARS 硬截断（嵌入模型端不再二次裁剪）。 */
export function chunkDocument(
  doc: { slug: string; title: string; kind: AskChunk['kind']; body: string },
): AskChunk[] {
  const prose = stripFences(doc.body);
  const sections: { heading: string; text: string }[] = [];
  const parts = prose.split(/^## /m);
  if (parts[0]?.trim()) {
    sections.push({ heading: '引言', text: parts[0] });
  }
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n');
    if (nl === -1) continue;
    sections.push({ heading: part.slice(0, nl).trim(), text: part.slice(nl + 1) });
  }
  return sections.map((section) => ({
    slug: doc.slug,
    title: doc.title,
    kind: doc.kind,
    heading: section.heading,
    text: stripInline(section.text).slice(0, MAX_CHUNK_CHARS),
  })).filter((chunk) => chunk.text.length >= 20);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 低于该分数的片段视为不相关——宁可不答，不硬凑（真实性条款的检索闸）。
    0.48 来自 2026-10-01 的离线体检：bge-m3 下合法问题 top1 ≥ 0.50
    （「小信是谁」0.515 是最低的），纯噪声 top1 ≤ 0.441（「学英语」「天气」），
    0.48 是两边之间的空档。改阈值前先跑体检脚本看分布。 */
export const MIN_RELEVANCE = 0.48;

export type ScoredChunk = IndexedChunk & { score: number };

export function retrieve(
  queryEmbedding: number[],
  chunks: IndexedChunk[],
  { topK = 4, minScore = MIN_RELEVANCE }: { topK?: number; minScore?: number } = {},
): ScoredChunk[] {
  return chunks
    .map((chunk) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export const SYSTEM_PROMPT = [
  '你是个人网站 XWSX（信我所行）的吉祥物小机器人，站长的定位是 RPA / AI Agent / 自动化方向的软件工程师与产品构建者。',
  '回答规则：',
  '1. 只依据【站内资料】回答；资料里没有的，直接说「站里没有写这方面」，绝不编造。',
  '2. 资料按相关度排序，可能混有与问题无关的片段——无关的忽略，不要硬凑；只答资料真正覆盖到的部分。',
  '3. 回答末尾另起一行列出依据的来源，格式严格为 [标题](/开头路径)——路径原样照抄资料括号里给出的路径，不要写「path:」等任何前缀。',
  '4. 中文，克制简短（200 字以内），语气与站点一致：温和、具体、不吹嘘。',
].join('\n');

/** 组装 chat/completions 的 messages。片段带 path 供引用；
    previous 是面板里的上一问，仅用于理解指代（「那第二步呢？」）。 */
export function buildMessages(
  question: string,
  contexts: { title: string; path: string; heading: string; text: string }[],
  previous?: string,
): { role: 'system' | 'user'; content: string }[] {
  const context = contexts
    .map((c) => `【${c.title} · ${c.heading}】(path: ${c.path})\n${c.text}`)
    .join('\n\n');
  const lead = previous
    ? `【上一问（供理解指代，不要回答它）】\n${previous}\n\n`
    : '';
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${lead}【站内资料】\n${context}\n\n【问题】\n${question}` },
  ];
}

/** 校验并规范 Base URL：只放行 https 或本地回环。
    来源是部署方环境变量而非请求输入（访客的问题只走 JSON body），
    这道闸防的是配置手误——比如把 http 明文端点带上生产、把 key 发去内网地址。 */
export function assertSafeBaseUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  const loopback =
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '[::1]';
  if (parsed.protocol !== 'https:' && !loopback) {
    throw new Error(
      `Base URL 必须是 https:// 或本地回环地址（当前：${rawUrl}）——明文 http 会把 API key 暴露在传输层。`,
    );
  }
  return rawUrl.replace(/\/+$/, '');
}

/** 清洗访客输入：去控制字符、折叠空白、截断。 */
export const MAX_QUESTION_CHARS = 300;

export function sanitizeQuestion(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex -- 控制字符就是要清掉的东西
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUESTION_CHARS);
}

/** 滑动窗口限流。单进程内存实现——站点就一个 Node 实例，重启清零可接受。
    hits 惰性修剪，防止 Map 无界增长。 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  private limit: number;

  private windowMs: number;

  private now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  check(key: string): { ok: boolean; retryAfterSec: number } {
    const t = this.now();
    const windowStart = t - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((ts) => ts > windowStart);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((arr[0] + this.windowMs - t) / 1000)),
      };
    }
    arr.push(t);
    this.hits.set(key, arr);
    if (this.hits.size > 5000) this.prune(windowStart);
    return { ok: true, retryAfterSec: 0 };
  }

  private prune(windowStart: number) {
    for (const [key, arr] of this.hits) {
      if (arr.length === 0 || arr[arr.length - 1] <= windowStart) this.hits.delete(key);
    }
  }
}

/** 解析 OpenAI 兼容 SSE 的一行，取出增量正文文本。
    Qwen3 系等推理模型会先发 delta.reasoning_content（思维链），那是内部独白，
    门口就丢弃——正文在 delta.content；非数据行（注释/[DONE]/坏 JSON）返回 null。 */
export function extractSseDelta(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  try {
    const json = JSON.parse(data) as {
      choices?: { delta?: { content?: string | null } }[];
    };
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}
