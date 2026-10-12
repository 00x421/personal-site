import { listThreads, queueReply } from '@/lib/wechat-store';

/**
 * 公众号留言管理台（私有页面，密钥即全部防线）。
 *
 * GET  /api/wechat/inbox                      → 密钥输入页
 * GET  /api/wechat/inbox?key=KEY              → 管理页（看对话、写回复）
 * GET  /api/wechat/inbox?key=KEY&list=1       → 对话 JSON（页面轮询用）
 * POST /api/wechat/inbox  {key,id,reply}      → 把回复排进队列，
 *                                                访客下次发消息即送达
 *
 * 站主把这个 URL 加上 key 收藏进手机：随时看谁留了言、随手写回复。
 * key 走 WECHAT_ADMIN_KEY 环境变量；整页 noindex 且无外链，不进搜索。
 */

const ADMIN_KEY = () => process.env.WECHAT_ADMIN_KEY ?? '';

const PAGE_SHELL = (body: string) =>
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<meta name="robots" content="noindex">` +
  `<title>技术快递柜 · 留言管理</title></head>` +
  `<body style="margin:0;background:#f7f5f0;color:#1a1a1a;` +
  `font:14px/1.7 'PingFang SC','Microsoft YaHei',sans-serif;">${body}</body></html>`;

function loginPage(wrong: boolean) {
  return PAGE_SHELL(
    `<div style="max-width:420px;margin:18vh auto;padding:0 20px;">` +
      `<h1 style="font-size:18px;">技术快递柜 · 留言管理</h1>` +
      (wrong ? `<p style="color:#b23b2e;">密钥不对，再试试。</p>` : '') +
      `<input id="key" type="password" placeholder="管理密钥（WECHAT_ADMIN_KEY）" ` +
      `style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:14px;"> ` +
      `<button onclick="location.href='?key='+encodeURIComponent(document.getElementById('key').value)" ` +
      `style="margin-top:10px;padding:10px 18px;background:#6355ce;color:#fff;border:0;border-radius:6px;font-size:14px;">进入</button>` +
      `</div>`,
  );
}

function inboxPage(key: string) {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return PAGE_SHELL(
    `<div style="max-width:640px;margin:0 auto;padding:20px 16px 60px;">` +
      `<h1 style="font-size:18px;">技术快递柜 · 留言管理</h1>` +
      `<p style="color:#8a877e;font-size:12.5px;">写好回复点「递出」——访客下次发任意消息即可收到。每 30 秒自动刷新。</p>` +
      `<div id="threads">加载中…</div>` +
      `</div>` +
      `<script>` +
      `var KEY=${JSON.stringify(esc(key))};` +
      `function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}` +
      `function load(){fetch('?key='+encodeURIComponent(KEY)+'&list=1').then(function(r){return r.json()}).then(function(threads){` +
      `var el=document.getElementById('threads');` +
      `if(!threads.length){el.innerHTML='<p style="color:#8a877e;">还没有对话。去公众号发条消息试试。</p>';return;}` +
      `el.innerHTML=threads.map(function(t){` +
      `var msgs=t.messages.map(function(m){var me=m.dir==='out';` +
      `return '<div style="margin:4px 0;text-align:'+(me?'right':'left')+';">' +` +
      `'<span style="display:inline-block;max-width:80%;padding:6px 10px;border-radius:8px;'+`+
      `(me?'background:#6355ce;color:#fff;':'background:#fff;border:1px solid #e5e2da;')+'">'+esc(m.text)+'</span></div>';` +
      `}).join('');` +
      `var q=t.queuedReply?'<p style="color:#b23b2e;font-size:12.5px;">待递出：'+esc(t.queuedReply)+'</p>':'';` +
      `return '<div style="background:#fff;border:1px solid #e5e2da;border-radius:10px;padding:14px;margin:14px 0;">' +` +
      `'<div style="font-size:11px;color:#8a877e;font-family:monospace;">'+esc(t.id.slice(0,10))+'…</div>'+msgs+q+` +
      `'<textarea id="r-'+esc(t.id)+'" rows="2" placeholder="写回复……访客下次发消息时收到" '+` +
      `'style="width:100%;box-sizing:border-box;margin-top:8px;padding:8px;border:1px solid #ccc;border-radius:6px;font:inherit;"></textarea>' +` +
      `'<button onclick="send(\\''+esc(t.id)+'\\')" style="margin-top:6px;padding:7px 14px;background:#1a1a1a;color:#fff;border:0;border-radius:6px;">递出</button></div>';` +
      `}).join('');` +
      `});}` +
      `function send(id){var el=document.getElementById('r-'+id);var reply=el.value.trim();if(!reply)return;` +
      `fetch('?key='+encodeURIComponent(KEY),{method:'POST',headers:{'content-type':'application/json'},` +
      `body:JSON.stringify({key:KEY,id:id,reply:reply})}).then(function(){load();});}` +
      `load();setInterval(load,30000);` +
      `</script>`,
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  const adminKey = ADMIN_KEY();
  if (!adminKey) {
    return new Response(
      PAGE_SHELL('<p style="padding:40px;">WECHAT_ADMIN_KEY 未配置，管理台不可用。</p>'),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  if (!key) return new Response(loginPage(false), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (key !== adminKey) {
    return new Response(loginPage(true), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (url.searchParams.get('list')) {
    return new Response(JSON.stringify(listThreads()), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  return new Response(inboxPage(key), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 8_192) {
    return new Response('{"ok":false}', { status: 413 });
  }
  try {
    const body = (await request.json()) as { key?: string; id?: string; reply?: string };
    if (!body.key || body.key !== ADMIN_KEY() || !body.id || !body.reply?.trim()) {
      return new Response('{"ok":false}', { status: 403 });
    }
    queueReply(body.id, body.reply.trim());
    return new Response('{"ok":true}', {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch {
    return new Response('{"ok":false}', { status: 400 });
  }
}
