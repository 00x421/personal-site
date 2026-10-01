/**
 * 数据层：从站点拉取公开内容 + TTL 缓存。
 *
 * 数据源是站点自己的 /api/content（公开端点，draft 已在站点侧过滤）。
 * stdio 模式默认指向线上；HTTP 模式部署在服务器上时指向本机回环，
 * 连 nginx 都不过。所有工具共用这一份缓存，TTL 内零网络请求。
 */

const SITE_URL = (
  process.env.XWSX_SITE_URL ?? 'https://xwsx.top'
).replace(/\/+$/, '');
const TTL_MS = Number(process.env.XWSX_CACHE_TTL_MS ?? 30 * 60 * 1000);

let cache = null;
let fetchedAt = 0;

async function load() {
  const res = await fetch(`${SITE_URL}/api/content`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`site /api/content responded ${res.status}`);
  }
  const data = await res.json();
  fetchedAt = Date.now();
  cache = data;
  return data;
}

/** TTL 内直接返回缓存；过期则重拉。重拉失败时回退旧数据（站点抖动不放大成工具失败）。 */
export async function getData() {
  if (cache && Date.now() - fetchedAt < TTL_MS) return cache;
  try {
    return await load();
  } catch (error) {
    if (cache) {
      console.error(`[xwsx-mcp] refresh failed, serving stale cache: ${error.message}`);
      return cache;
    }
    throw error;
  }
}

export const siteUrl = SITE_URL;
