/**
 * 构建期生成站内 AI 问答的向量索引（npm run build 的 prebuild 步骤自动跑）。
 *
 * 流程：fs 直读 content/（与 generate-og.ts 同一先例，运行时零文件系统依赖）
 *   → lib/ask.ts 切片 → 调 embedding API 算向量 → 写 lib/ask-index.generated.ts。
 *
 * 环境变量（见 .env.example）：
 *   ASK_EMBED_BASE_URL / ASK_EMBED_API_KEY / ASK_EMBED_MODEL
 *
 * 未配置 key 时写入 enabled:false 的空索引并正常退出——CI 上没有 key，
 * 构建必须照常通过，功能整体关闭。配置了 key 但 API 调用失败则**大声失败**
 * （exit 1）：这是刻意设计，本仓库吃过太多「不报错但也没生效」的亏。
 *
 * 生成物为派生产物：内容不变 + 模型不变 → 向量不变，git 里通常无 diff。
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertSafeBaseUrl,
  chunkDocument,
  chunkPath,
  MAX_CHUNK_CHARS,
  type AskChunk,
  type AskIndex,
  type IndexedChunk,
} from '../lib/ask.ts';
import { readList, readString, splitFrontmatter } from '../lib/content-parse.ts';
import { capabilities, siteDescription, siteIdentity, siteTitle, toolbox } from '../lib/site-content.ts';

const BASE_URL = process.env.ASK_EMBED_BASE_URL ?? 'https://api.siliconflow.cn/v1';
const API_KEY = process.env.ASK_EMBED_API_KEY ?? '';
const MODEL = process.env.ASK_EMBED_MODEL ?? 'BAAI/bge-m3';
const OUT_FILE = path.resolve('lib/ask-index.generated.ts');

/** 目录名由 kind 白名单映射，不接受自由字符串拼接路径。 */
function readDocs(kind: 'article' | 'project'): { slug: string; title: string; kind: 'article' | 'project'; body: string }[] {
  const dir = kind === 'article' ? 'articles' : 'projects';
  const full = path.resolve('content', dir);
  let files: string[] = [];
  try {
    files = readdirSync(full).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.map((file) => {
    const raw = readFileSync(path.join(full, file), 'utf8');
    const { data, body } = splitFrontmatter(raw);
    return {
      slug: file.replace(/\.md$/, ''),
      title: readString(data, 'title') ?? file,
      kind,
      body,
    };
  });
}

/** 书架进索引：访客问「在看什么书」必须有的答。
    books 只认 frontmatter（正文不渲染），片段引用统一指向 /books。 */
function bookChunks(): AskChunk[] {
  const full = path.resolve('content', 'books');
  let files: string[] = [];
  try {
    files = readdirSync(full).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  return files.flatMap((file) => {
    const { data } = splitFrontmatter(readFileSync(path.join(full, file), 'utf8'));
    const title = readString(data, 'title');
    if (!title) return [];
    const parts = [
      `书架：《${title}》`,
      readString(data, 'author') && `作者 ${readString(data, 'author')}`,
      readString(data, 'status') && `状态：${readString(data, 'status')}`,
      readString(data, 'started') && `开始于 ${readString(data, 'started')}`,
      readString(data, 'takeaway'),
      readList(data, 'tags').length > 0 && `标签：${readList(data, 'tags').join('、')}`,
    ].filter(Boolean);
    return [
      {
        slug: 'books',
        title: `书架 · ${title}`,
        kind: 'book',
        heading: '书架',
        text: parts.join('。').slice(0, MAX_CHUNK_CHARS),
      },
    ];
  });
}

/** 站点自述片段：让机器人答得了「这是谁的站 / 站长能做什么 / 小信是谁」。 */
function metaChunks(): AskChunk[] {
  const text = [
    siteTitle,
    siteDescription,
    `站长 ${siteIdentity.name}（字标 ${siteIdentity.brand}），联系方式 ${siteIdentity.email}，GitHub ${siteIdentity.github}。`,
    `能做的事：${capabilities.map((c) => `${c.name}——${c.detail}`).join(' ')}`,
    `工具箱：${toolbox.map(([level, items]) => `${level}：${items.join('、')}`).join('；')}`,
    `吉祥物叫「${siteIdentity.botName}」——一个 GrokBot 风格的紫色小机器人（形象改编自开源项目 LaoA-GrokBot），也就是这个问答助手本人。它只依据站内内容回答，答不出就直说；站点导航右下角还能搜索全站（Ctrl/Cmd+K）。`,
  ].join('\n');
  return [
    {
      slug: 'site',
      title: '关于本站',
      kind: 'meta',
      heading: '站点自述',
      text: text.slice(0, MAX_CHUNK_CHARS),
    },
  ];
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${assertSafeBaseUrl(BASE_URL)}/embeddings`, {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`embedding API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function writeIndexFile(index: AskIndex): void {
  const body = JSON.stringify(index, null, 2);
  writeFileSync(
    OUT_FILE,
    `// 由 scripts/generate-ask-index.ts 生成（prebuild 自动跑），勿手改。\n` +
      `import type { AskIndex } from './ask.ts';\n` +
      `export const askIndex: AskIndex = ${body};\n`,
  );
}

const docs = [
  ...readDocs('article'),
  ...readDocs('project'),
];
const chunks: AskChunk[] = [
  ...docs.flatMap((doc) => chunkDocument(doc)),
  ...bookChunks(),
  ...metaChunks(),
];

if (!API_KEY) {
  writeIndexFile({ enabled: false, embedModel: MODEL, chunks: [] });
  console.log(
    `ask-index: 未配置 ASK_EMBED_API_KEY，写入空索引（${chunks.length} 个片段被跳过），AI 问答整体关闭。`,
  );
  process.exit(0);
}

try {
  const vectors = await embed(chunks.map((c) => `${c.title} ${c.heading}\n${c.text}`));
  const indexed: IndexedChunk[] = chunks.map((chunk, i) => ({ ...chunk, embedding: vectors[i] }));
  writeIndexFile({ enabled: true, embedModel: MODEL, chunks: indexed });
  console.log(`ask-index: ${indexed.length} 个片段已写入向量索引（${MODEL}）。`);
} catch (error) {
  console.error('ask-index: 向量 API 调用失败，构建中止（修复后重跑，不要绕过此检查）：');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
