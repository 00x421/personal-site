import { assertSafeBaseUrl } from '@/lib/ask';
import { askIndex } from '@/lib/ask-index.generated';
import { embedQuery, retrieve, sanitizeQuestion, SlidingWindowLimiter } from '@/lib/ask';

/**
 * 语义搜索兜底：⌘K 里字面零命中时，客户端会 POST 到这里，
 * 用与「问小信」同一份向量索引做语义检索。
 *
 * 返回与 /search.json 相同形状的结果子集（title/url/desc/type），
 * 客户端可以直接复用既有的搜索条渲染与键盘动线。
 *
 * 降级纪律：索引未启用、embed 上游抖动 → 返回空结果而不是报错——
 * 语义兜底本来就是增强，不该让用户看见它的故障。
 */

const PER_IP_LIMIT = 30;
const PER_IP_WINDOW_MS = 60 * 1000;
const perIpLimiter = new SlidingWindowLimiter(PER_IP_LIMIT, PER_IP_WINDOW_MS);

/** 语义兜底的相关度门槛：比问答闸（0.48）宽松——搜索是排序列表，
    由人挑而不是模型答；但也不下探到噪声区（实测纯噪声 ≤0.441）。 */
const SEARCH_MIN_SCORE = 0.42;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 2_000) {
    return json({ results: [] }, 413);
  }
  if (!askIndex.enabled) return json({ results: [] });

  let query = '';
  try {
    const body = (await request.json()) as { q?: string };
    query = sanitizeQuestion(String(body.q ?? ''));
  } catch {
    return json({ results: [] }, 400);
  }
  if (!query) return json({ results: [] });

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const perIp = perIpLimiter.check(ip);
  if (!perIp.ok) return json({ results: [] });

  let embedding: number[] | null;
  try {
    embedding = await embedQuery(query, { fallbackModel: askIndex.embedModel });
  } catch {
    embedding = null;
  }
  if (!embedding) return json({ results: [] });

  const seen = new Map<
    string,
    { title: string; url: string; desc: string; type: string; meta: string }
  >();
  for (const hit of retrieve(embedding, askIndex.chunks, {
    topK: 8,
    minScore: SEARCH_MIN_SCORE,
  })) {
    if (hit.kind === 'meta') continue;
    const url =
      hit.kind === 'article'
        ? `/articles/${hit.slug}`
        : hit.kind === 'project'
          ? `/projects/${hit.slug}`
          : '/books';
    if (seen.has(url)) continue;
    seen.set(url, {
      title: hit.title,
      url,
      desc: hit.text.slice(0, 140),
      type: hit.kind,
      meta: '',
    });
    if (seen.size >= 4) break;
  }
  return json({ results: [...seen.values()] });
}
