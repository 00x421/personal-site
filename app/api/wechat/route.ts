import { articles } from '@/data/articles';
import { books } from '@/data/books';
import { projects } from '@/data/projects';
import { buildSearchEntries, type SearchEntry } from '@/lib/feed-builders';
import { askIndex } from '@/lib/ask-index.generated';
import { embedQuery, retrieve, sanitizeQuestion } from '@/lib/ask';
import {
  parseCallbackXml,
  pushToOwner,
  textReplyXml,
  verifyWechatSignature,
} from '@/lib/wechat';

/**
 * 公众号消息回调（个人订阅号，站主的「技术快递柜」）。
 *
 * GET ：微信「服务器配置」保存时的 echostr 校验（只需 WECHAT_VERIFY_TOKEN）。
 * POST：粉丝消息，分两种——
 *   「搜 关键词」→ 站内检索，5 秒内被动回复最相关的文章；
 *   其余一律当作给站主的留言：推送（飞书/企业微信 webhook）+ 自动确认回执。
 *
 * 个人未认证号没有客服消息接口，应答必须挤在这一条 5 秒内的被动回复里；
 * 刻意不调 LLM（生成动辄 5s+，超时微信会重试三次并显示服务故障）。
 * 检索双通道：关键词先查（毫秒级），零命中再落语义（embed 数百毫秒）。
 */

const searchEntries: SearchEntry[] = buildSearchEntries({
  articles,
  projects,
  books,
});

const WELCOME =
  '欢迎来到技术快递柜 📦 我是站长的机器人小信。\n\n' +
  '直接发消息 = 给站长留言，他会收到推送；\n' +
  '发「搜 关键词」可以从他的文章里找东西，比如「搜 字体」。\n\n' +
  '站长也常在 https://xwsx.top 出没。';

const RECEIPT =
  '留言已收到 ✓ 站长会看到这条（他的通知是实时推送的）。\n' +
  '想得到回复的话，可以在留言里留下你的联系方式。\n\n' +
  '顺便：发「搜 关键词」可以查站内文章。';

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
    return `柜子里还没有和「${query}」相关的东西。\n换个词试试，或者直接给站长留言。`;
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

/** 微信 5 秒收不到响应会原样重发同一条消息——按 MsgId 去重，防重复留言。 */
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
  // 任何分支都必须在 5 秒内回 XML——兜底 catch 也回一条可读的失败文案，
  // 而不是让微信把「服务故障」甩在访客脸上。
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

    const raw = await request.text();
    const message = parseCallbackXml(raw);
    if (!message) return new Response('success');

    // 重发去重：窗口 2 分钟，顺带清理过期项防 Map 无界增长
    const now = Date.now();
    for (const [id, ts] of seenMsgIds) {
      if (now - ts > 120_000) seenMsgIds.delete(id);
    }
    if (message.msgId && seenMsgIds.has(message.msgId)) {
      return new Response('success');
    }
    if (message.msgId) seenMsgIds.set(message.msgId, now);

    const reply = (content: string) =>
      new Response(textReplyXml(message.fromUser, message.toUser, content), {
        headers: { 'content-type': 'application/xml; charset=utf-8' },
      });

    // 关注 / 取关
    if (message.msgType === 'event') {
      if (message.event === 'subscribe') return reply(WELCOME);
      return new Response('success');
    }
    if (message.msgType !== 'text' || !message.content.trim()) {
      void pushToOwner(`[公众号] 收到一条 ${message.msgType || '?'} 消息（内容非文字，未转达）`);
      return reply('收到了！不过素材类消息转达不到站长那里，发文字最稳妥。');
    }

    const text = sanitizeQuestion(message.content);

    // 「搜 …」→ 检索模式；其余 → 留言
    const searchMatch = /^(?:搜|找|查)[:：\s]+(.+)$/.exec(text);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      const keywordHits = keywordSearch(query);
      const semanticHits =
        keywordHits.length > 0 ? [] : await semanticSearch(query);
      return reply(formatHits(query, keywordHits, semanticHits));
    }

    void pushToOwner(
      `[公众号留言]\n时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n留言：${text.slice(0, 500)}`,
    );
    return reply(RECEIPT);
  } catch {
    // 到这里时连发件人都未必解析得出来，被动回复没法定向——
    // 回 success 让微信安静收场，别把「服务故障」甩在访客脸上
    return new Response('success');
  }
}
