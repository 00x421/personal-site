import {
  assertSafeBaseUrl,
  buildMessages,
  chunkPath,
  extractSseDelta,
  retrieve,
  sanitizeQuestion,
  SlidingWindowLimiter,
} from '@/lib/ask';
import { askIndex } from '@/lib/ask-index.generated';

/**
 * 站内 AI 问答接口。
 *
 * POST /api/ask {question} → NDJSON 流：
 *   {"t":"d","v":"增量文本"}* → {"t":"s","sources":[{title,path}]}（成功收尾）
 *   或 {"t":"e","message":"..."}（失败）
 * GET /api/ask → {enabled, model}——客户端据此决定是否展示提问入口。
 *
 * 风控（免费额度保护）：单 IP 每小时 8 问 + 全站每天 1000 问，
 * 内存滑动窗口（单 Node 进程部署，重启清零可接受）；
 * 问题 300 字截断、LLM max_tokens 1500、上游 30s 超时。
 */

const PER_IP_LIMIT = 8;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_LIMIT = 1000;

const perIpLimiter = new SlidingWindowLimiter(PER_IP_LIMIT, PER_IP_WINDOW_MS);
const globalLimiter = new SlidingWindowLimiter(GLOBAL_DAILY_LIMIT, 24 * 60 * 60 * 1000);

function llmConfig() {
  const baseURL = process.env.ASK_LLM_BASE_URL;
  const apiKey = process.env.ASK_LLM_API_KEY;
  const model = process.env.ASK_LLM_MODEL;
  // 守卫防的是部署配置手误（http 明文/内网地址），非请求输入（见 assertSafeBaseUrl）
  return baseURL && apiKey && model
    ? { baseURL: assertSafeBaseUrl(baseURL), apiKey, model }
    : null;
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function GET() {
  const llm = llmConfig();
  return json({ enabled: askIndex.enabled && !!llm, model: llm?.model ?? null });
}

async function embedQuestion(question: string): Promise<number[] | null> {
  // 环境变量是部署方配置（非请求输入）；守卫防的是配置手误（http 明文/内网地址）
  const baseURL = assertSafeBaseUrl(
    process.env.ASK_EMBED_BASE_URL ?? 'https://api.siliconflow.cn/v1',
  );
  const apiKey = process.env.ASK_EMBED_API_KEY;
  const model = process.env.ASK_EMBED_MODEL ?? askIndex.embedModel;
  if (!apiKey) return null;
  const res = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: [question] }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0]?.embedding ?? null;
}

/** 上游 SSE → 站点自己的 NDJSON 事件流。 */
function ndjsonEvent(event: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  const llm = llmConfig();
  if (!askIndex.enabled || !llm) {
    return json({ error: 'ask-disabled' }, 503);
  }

  let question = '';
  let previous = '';
  try {
    const body = (await request.json()) as { question?: string; previous?: string };
    question = sanitizeQuestion(String(body.question ?? ''));
    // 上一问仅用于理解指代（「那第二步呢？」），同样清洗限长
    previous = sanitizeQuestion(String(body.previous ?? ''));
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  if (!question) return json({ error: 'empty-question' }, 400);

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const perIp = perIpLimiter.check(ip);
  if (!perIp.ok) {
    return json(
      { error: 'rate-limited', retryAfterSec: perIp.retryAfterSec },
      429,
      { 'retry-after': String(perIp.retryAfterSec) },
    );
  }
  // 刻意在业务校验之前计数：限流的目的是给免费额度上闸，
  // 失败的请求同样消耗服务器资源；恢复能力靠 retryAfterSec 引导重试
  const global = globalLimiter.check('site');
  if (!global.ok) {
    return json(
      { error: 'rate-limited-global', retryAfterSec: global.retryAfterSec },
      429,
      { 'retry-after': String(global.retryAfterSec) },
    );
  }

  let queryEmbedding: number[] | null;
  try {
    // 指代消解的廉价做法：把上一问拼进检索 query——「那第二步呢？」
    // 单独 embed 会完全失焦，拼上「上一问」后向量才有落点
    queryEmbedding = await embedQuestion(previous ? `${previous} ${question}` : question);
  } catch {
    queryEmbedding = null;
  }
  if (!queryEmbedding) {
    return json({ error: 'embed-failed' }, 502);
  }

  const hits = retrieve(queryEmbedding, askIndex.chunks, { topK: 4 });
  if (hits.length === 0) {
    // 检索闸：站里没写过就不劳烦 LLM，诚实作答还省额度
    return new Response(
      ndjsonEvent({
        t: 's',
        sources: [],
        text: '这个问题站里还没有写过相关内容，我答不了——不知道就是不知道，不瞎编。',
      }),
      { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${llm.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${llm.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        messages: buildMessages(
          question,
          hits.map((hit) => ({
            title: hit.title,
            path: chunkPath(hit),
            heading: hit.heading,
            text: hit.text,
          })),
          previous,
        ),
        stream: true,
        // Qwen3 系是推理模型，思维链会把 max_tokens 吃光导致正文为空；
        // 显式关闭（上游非推理模型会忽略此参数），1500 是回答 + 引用的余量。
        enable_thinking: false,
        max_tokens: 1500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return json({ error: 'llm-unreachable' }, 502);
  }
  if (!upstream.ok || !upstream.body) {
    return json({ error: 'llm-failed', status: upstream.status }, 502);
  }

  const sources = [...new Map(hits.map((hit) => [chunkPath(hit), { title: hit.title, path: chunkPath(hit) }])).values()];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 访客中途关面板时 enqueue/close 会对已关闭的流抛错——吞掉即可，
      // 上游读取随 finally 的 reader.releaseLock 自然收尾。
      const safeEnqueue = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(ndjsonEvent(event));
        } catch {
          /* client gone */
        }
      };
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const delta = extractSseDelta(line);
            if (delta) safeEnqueue({ t: 'd', v: delta });
          }
        }
        safeEnqueue({ t: 's', sources });
      } catch {
        safeEnqueue({ t: 'e', message: '回答到一半断了，再问一次试试。' });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
