import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * 微信公众号（个人订阅号）对接的最小客户端。
 *
 * 分两层：回调层（签名校验 / XML 解析 / 被动回复）只依赖 Token，消息
 * 应答在 5 秒预算内全靠它；API 层（access_token / 素材 / 草稿箱）依赖
 * AppID + AppSecret，只有「发文同步草稿箱」用。
 *
 * AppSecret 是敏感凭据：只从服务端环境变量读（ask.env，600 权限），
 * 永远不进代码与客户端包。微信 IP 白名单需包含服务器出口 IP，
 * 否则 token 接口报 40164。
 */

export function verifyWechatSignature(
  token: string,
  signature: string,
  timestamp: string,
  nonce: string,
): boolean {
  if (!token || !signature || !timestamp || !nonce) return false;
  const hash = createHash('sha1')
    .update([token, timestamp, nonce].sort().join(''))
    .digest('hex');
  return hash === signature;
}

export type WechatMessage = {
  fromUser: string;
  toUser: string;
  msgType: string;
  /** 事件类消息（关注/取关）的事件名在 <Event>，不在 <Content> */
  event: string;
  content: string;
  msgId: string;
};

/** 微信回调是扁平 XML（无属性无命名空间），手写解析足够，不为它引库。
    CDATA 与裸文本两种形态都接。 */
export function parseCallbackXml(xml: string): WechatMessage | null {
  function pick(tag: string): string {
    const match = new RegExp(
      `<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`,
    ).exec(xml);
    return match ? match[1] : '';
  }
  const msgType = pick('MsgType');
  if (!msgType) return null;
  return {
    fromUser: pick('FromUserName'),
    toUser: pick('ToUserName'),
    msgType,
    event: pick('Event'),
    content: pick('Content'),
    msgId: pick('MsgId'),
  };
}

/** 被动回复一条文本。个人未认证号没有客服消息接口，
    所有应答都必须挤在这一条 5 秒内的回复里。 */
export function textReplyXml(toUser: string, fromUser: string, content: string): string {
  const stamp = Math.floor(Date.now() / 1000);
  return (
    '<xml>' +
    `<ToUserName><![CDATA[${toUser}]]></ToUserName>` +
    `<FromUserName><![CDATA[${fromUser}]]></FromUserName>` +
    `<CreateTime>${stamp}</CreateTime>` +
    '<MsgType><![CDATA[text]]></MsgType>' +
    `<Content><![CDATA[${content}]]></Content>` +
    '</xml>'
  );
}

// ---- 以下需要 WECHAT_APP_ID / WECHAT_APP_SECRET（发文同步草稿箱用） ----

let tokenCache: { token: string; expiresAt: number } | null = null;

/** access_token 有效期 7200s，提前 5 分钟刷新；进程内缓存足够
    （单机部署，多实例才需要外部存储）。 */
export async function getAccessToken(): Promise<string> {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('WECHAT_APP_ID / WECHAT_APP_SECRET 未配置');
  }
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };
  if (!data.access_token) {
    throw new Error(`获取 access_token 失败：${data.errcode} ${data.errmsg}`);
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 7200) - 300) * 1000,
  };
  return tokenCache.token;
}

/** 封面图必须是微信永久素材（正文外链图在公众号里显示不出来）。
    OG 图是 PNG，永久素材上限 10MB，余量充足。 */
export async function uploadMaterialImage(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const token = await getAccessToken();
  const form = new FormData();
  form.append(
    'media',
    new Blob([new Uint8Array(buffer)], { type: 'image/png' }),
    filePath.split(/[\\/]/).pop() ?? 'cover.png',
  );
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`,
    { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) },
  );
  const data = (await res.json()) as {
    media_id?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (!data.media_id) {
    throw new Error(`上传封面素材失败：${data.errcode} ${data.errmsg}`);
  }
  return data.media_id;
}

export async function createDraft(input: {
  title: string;
  digest: string;
  contentHtml: string;
  coverMediaId: string;
  sourceUrl: string;
  author: string;
}): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        articles: [
          {
            title: input.title,
            author: input.author,
            digest: input.digest,
            content: input.contentHtml,
            content_source_url: input.sourceUrl,
            need_open_comment: 0,
            only_fans_can_comment: 0,
            thumb_media_id: input.coverMediaId,
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const data = (await res.json()) as {
    media_id?: string;
    errcode?: number;
    errmsg?: string;
  };
  if (!data.media_id) {
    throw new Error(`推进草稿箱失败：${data.errcode} ${data.errmsg}`);
  }
  return data.media_id;
}

// ---- 留言推送：把粉丝消息实时转达给站主 ----

/** 站主通知渠道：按环境变量依次探测，谁配了用谁（按「直达微信」优先排序）——
    SERVERCHAN_SENDKEY（Server酱，推送到个人微信，免费额度 5 条/日）、
    PUSHPLUS_TOKEN（PushPlus，同样进个人微信）、
    LARK_WEBHOOK（飞书群机器人）、WECOM_WEBHOOK（企业微信群机器人）。
    个人订阅号没有客服消息，站主无法在公众号里回复访客——留言的
    「送达站主」这一段必须靠这些推送。webhook 未配置时只记日志不报错：
    回调对访客的确认回复不应该因为站主自己的配置缺失而失败。 */
export async function pushToOwner(text: string): Promise<boolean> {
  const serverchan = process.env.SERVERCHAN_SENDKEY;
  const pushplus = process.env.PUSHPLUS_TOKEN;
  const lark = process.env.LARK_WEBHOOK;
  const wecom = process.env.WECOM_WEBHOOK;
  const title = text.split('\n')[0].slice(0, 40);
  try {
    if (serverchan) {
      // Server酱 Turbo：form 表单，title + desp（markdown 正文）
      const form = new FormData();
      form.append('title', title);
      form.append('desp', text);
      const res = await fetch(
        `https://sctapi.ftqq.com/${serverchan}.send`,
        { method: 'POST', body: form, signal: AbortSignal.timeout(8_000) },
      );
      return res.ok;
    }
    if (pushplus) {
      const res = await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: pushplus,
          title,
          content: text,
          template: 'txt',
        }),
        signal: AbortSignal.timeout(8_000),
      });
      return res.ok;
    }
    if (lark) {
      const res = await fetch(lark, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ msg_type: 'text', content: { text } }),
        signal: AbortSignal.timeout(8_000),
      });
      return res.ok;
    }
    if (wecom) {
      const res = await fetch(wecom, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
        signal: AbortSignal.timeout(8_000),
      });
      return res.ok;
    }
  } catch {
    return false;
  }
  return false;
}
