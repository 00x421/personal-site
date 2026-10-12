import { articles } from '@/data/articles';
import { books } from '@/data/books';
import { projects } from '@/data/projects';
import { buildSearchEntries, type SearchEntry } from '@/lib/feed-builders';
import { askIndex } from '@/lib/ask-index.generated';
import {
  buildMessages,
  embedQuery,
  getLlmConfig,
  retrieve,
  sanitizeQuestion,
} from '@/lib/ask';
import {
  parseCallbackXml,
  pushToOwner,
  textReplyXml,
  verifyWechatSignature,
} from '@/lib/wechat';
import { appendMessage, takeQueuedReply } from '@/lib/wechat-store';

/**
 * 公众号消息回调（个人订阅号「技术快递柜」）。
 *
 * GET ：微信「服务器配置」的 echostr 校验（只需 WECHAT_VERIFY_TOKEN）。
 * POST：粉丝消息，按优先级四档处理——
 *   ① 站主的待回复队列非空 → 先送达站主的回复（对讲机模式）；
 *   ② 「站长 xxx」→ 留言：推送站主 + 回执（他回复后你下条消息收到）；
 *   ③ 「搜 xxx」→ 站内检索（关键词→语义）；
 *   ④ 其他文字 → 小信 AI 快答：LLM 限时 3.2s 内依据站内资料作答，
 *      超时/无资料落回检索，再落兜底文案。
 *
 * 硬约束：未认证订阅号只有这一条 5 秒内的被动回复可用（无客服消息），
 * 所以全流程按 remaining() 预算跑，LLM 显式限时，绝不赌生成速度。
 * 留言/对话历史落 lib/wechat-store（JSON 文件），管理页看 /api/wechat/inbox。
 */

const searchEntries: SearchEntry[] = buildSearchEntries({
  articles,
  projects,
  books,
});

const WELCOME =
  '欢迎来到技术快递柜 📦 站长的小信在此。\n\n' +
  '· 直接发问题，我依据站内文章回答\n' +
  '· 发「搜 关键词」查文章\n' +
  '· 发「站长 你想说的话」给站长捎话（他手机会弹）\n\n' +
  '站长的回复到你下次发消息时送达。他也常年在 xwsx.top 出没。';

const OWNER_RECEIPT =
  '捎话成功 ✓ 站长会收到实时推送。\n' +
  '他回复后，你再发任意消息（比如发个「1」）就能收到。';

const HINT =
  '直接发你的问题就行；也可以发「搜 关键词」查文章，' +
  '或「站长 内容」给站长捎话。';

const WECHAT_SYSTEM_PROMPT = [
  '你是微信公众号「技术快递柜」的机器人小信，站长是 xwsx.top（信我所行）的博主。',
  '规则：',
  '1. 只依据【站内资料】回答；资料里没有的，直说「这个站里还没写过」，绝不编造。',
  '2. 不超过 120 字，中文，语气与站点一致：温和、具体、不吹嘘。',
  '3. 不要输出任何链接和 markdown 记号（微信纯文本环境）。',
  '4. 用到了资料就在末尾另起一行写「来源：《标题》」，最多一个。',
].join('\n');

function keywordSearch(query: string): SearchEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return searchEntries
    .map((entry) => {
      const title = entry.title.toLowerCase();
      let score = 0;
      for (const term of terms) {
        let hit = 0;
        if (title.includes(term)) hit += 6;
        if (entry.tags.some((tag) => tag.toLowerCase().includes(term))) hit += 4;
        if (entry.desc.toLowerCase().includes(term)) hit += 2;
        if (entry.text.includes(term)) hit += 1;
        if (hit === 0) return { entry, score: 0 };
        score += hit;
      }
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.entry);
}

async function semanticSearch(
  query: string,
): Promise<{ title: string; url: string }[]> {
  try {
    const embedding = await embedQuery(query, {
      fallbackModel: askIndex.embedModel,
    });
    if (!embedding) return [];
    return retrieve(embedding, askIndex.chunks, { topK: 2, minScore: 0.42 })
      .filter((hit) => hit.kind !== 'meta')
      .map((hit) => ({
        title: hit.title,
        url:
          hit.kind === 'article'
            ? `https://xwsx.top/articles/${hit.slug}`
            : hit.kind === 'project'
              ? `https://xwsx.top/projects/${hit.slug}`
              : 'https://xwsx.top/books',
      }));
  } catch {
    return [];
  }
}

function formatHits(
  query: string,
  keywordHits: SearchEntry[],
  semanticHits: { title: string; url: string }[],
): string {
  if (keywordHits.length === 0 && semanticHits.length === 0) {
    return `柜子里还没有和「${query}」相关的东西。\n换个词试试，或发「站长 内容」给站长捎话。`;
  }
  const lines = [`柜里找到 ${keywordHits.length + semanticHits.length} 件和「${query}」相关：`, ''];
  let index = 1;
  for (const entry of keywordHits) {
    lines.push(`${index}. ${entry.title}`, `   ${entry.url.replace('https://xwsx.top', 'xwsx.top')}`, '');
    index += 1;
  }
  for (const hit of semanticHits) {
    lines.push(`${index}. ${hit.title}`, `   ${hit.url.replace('https://xwsx.top', 'xwsx.top')}`, '');
    index += 1;
  }
  lines.push('（链接在微信里点不了，复制到浏览器打开）');
  return lines.join('\n');
}

/** 被动回复上限 2000 字节（UTF-8），中文一字三字节——550 字封顶留余量。 */
function cap(text: string): string {
  return text.length > 550 ? `${text.slice(0, 540)}……` : text;
}

/** AI 快答：LLM 限时内依据检索资料作答；任何一步不济就落回检索。 */
async function fastAnswer(query: string, remainingMs: () => number): Promise<string> {
  const llm = getLlmConfig();
  if (!llm || remainingMs() < 1200) {
    const hits = keywordSearch(query);
    return formatHits(query, hits, []);
  }

  let contexts: { title: string; heading: string; text: string }[] = [];
  let sources: string[] = [];
  try {
    const embedding = await embedQuery(query, {
      fallbackModel: askIndex.embedModel,
    });
    if (embedding) {
      const hits = retrieve(embedding, askIndex.chunks, { topK: 3 });
      contexts = hits.map((hit) => ({
        title: hit.title,
        heading: hit.heading,
        text: hit.text,
      }));
      sources = [...new Set(hits.map((hit) => hit.title))];
    }
  } catch {
    /* embed 失败就不带资料问 LLM，真实性条款会让它承认不知道 */
  }

  const llmBudget = Math.min(3_200, remainingMs() - 300);
  if (llmBudget < 800) return formatHits(query, keywordSearch(query), []);

  try {
    const res = await fetch(`${llm.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${llm.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: 'system', content: WECHAT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: contexts.length
              ? `【站内资料】\n${contexts
                  .map((c) => `【${c.title} · ${c.heading}】\n${c.text}`)
                  .join('\n\n')}\n\n【问题】\n${query}`
              : query,
          },
        ],
        // Qwen3 系推理模型必须显式关思维链，否则预算内出不了正文
        enable_thinking: false,
        max_tokens: 400,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(llmBudget),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (answer) {
        const source = sources[0] ? `\n来源：《${sources[0]}》` : '';
        return cap(`${answer}${source}`);
      }
    }
  } catch {
    /* 超时/上游抖动：落回检索 */
  }
  return formatHits(query, keywordSearch(query), []);
}

const seenMsgIds = new Map<string, number>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WECHAT_VERIFY_TOKEN ?? '';
  const ok = verifyWechatSignature(
    token,
    url.searchParams.get('signature') ?? '',
    url.searchParams.get('timestamp') ?? '',
    url.searchParams.get('nonce') ?? '',
  );
  if (!ok) return new Response('forbidden', { status: 403 });
  return new Response(url.searchParams.get('echostr') ?? '', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const remaining = () => 4_500 - (Date.now() - startedAt);
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 8_192) {
      return new Response('success');
    }
    const url = new URL(request.url);
    const token = process.env.WECHAT_VERIFY_TOKEN ?? '';
    if (
      !verifyWechatSignature(
        token,
        url.searchParams.get('signature') ?? '',
        url.searchParams.get('timestamp') ?? '',
        url.searchParams.get('nonce') ?? '',
      )
    ) {
      return new Response('forbidden', { status: 403 });
    }

    const message = parseCallbackXml(await request.text());
    if (!message) return new Response('success');

    const now = Date.now();
    for (const [id, ts] of seenMsgIds) {
      if (now - ts > 120_000) seenMsgIds.delete(id);
    }
    if (message.msgId && seenMsgIds.has(message.msgId)) {
      return new Response('success');
    }
    if (message.msgId) seenMsgIds.set(message.msgId, now);

    const reply = (content: string) =>
      new Response(textReplyXml(message.fromUser, message.toUser, cap(content)), {
        headers: { 'content-type': 'application/xml; charset=utf-8' },
      });

    if (message.msgType === 'event') {
      if (message.event === 'subscribe') return reply(WELCOME);
      return new Response('success');
    }
    if (message.msgType !== 'text' || !message.content.trim()) {
      void pushToOwner(`[公众号] 收到一条 ${message.msgType || '?'} 消息（内容非文字，未转达）`);
      return reply('收到了！不过素材类消息转达不到站长那里，发文字最稳妥。');
    }

    const text = sanitizeQuestion(message.content);
    appendMessage(message.fromUser, 'in', text);

    // ① 站主的待回复队列：对讲机取件优先于一切
    const queued = takeQueuedReply(message.fromUser);
    if (queued) {
      return reply(`【站长的回复】\n${queued}\n\n——有新问题直接继续发。`);
    }

    // ② 留言给站长
    const ownerMatch = /^(?:站长|站主)[:：\s]+([\s\S]+)$/.exec(text);
    if (ownerMatch) {
      void pushToOwner(
        `[公众号留言]\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n留言：${ownerMatch[1].slice(0, 500)}`,
      );
      return reply(OWNER_RECEIPT);
    }

    // ③ 检索模式
    const searchMatch = /^(?:搜|找|查)[:：\s]+(.+)$/.exec(text);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      const keywordHits = keywordSearch(query);
      const semanticHits =
        keywordHits.length > 0 ? [] : await semanticSearch(query);
      return reply(formatHits(query, keywordHits, semanticHits));
    }

    // ④ 小信 AI 快答（超时自动落回检索结果）
    if (remaining() < 1000 || askIndex.enabled === false) {
      return reply(HINT);
    }
    const answer = await fastAnswer(text, remaining);
    return reply(answer);
  } catch {
    // 连发件人都未必解析得出来时被动回复没法定向——回 success 让微信安静收场
    return new Response('success');
  }
}
