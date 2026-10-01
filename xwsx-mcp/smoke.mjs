/**
 * MCP server 冒烟测试（node smoke.mjs）：
 * 1. stdio：spawn server.mjs，连 Client，list tools + 调 search_site / get_article
 * 2. http：起 --http 子进程，Client 走 StreamableHTTP 连 127.0.0.1，调工具 + 限流探测
 * 断言失败即退出码 1。需要站点可达（XWSX_SITE_URL，默认线上）。
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'node:child_process';

const SITE = process.env.XWSX_SITE_URL ?? 'https://xwsx.top';
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? '  [PASS]' : '  [FAIL]'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function withStdio() {
  console.log('stdio 模式：');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['server.mjs'],
    env: { ...process.env, XWSX_SITE_URL: SITE },
  });
  const client = new Client({ name: 'smoke', version: '0.0.0' });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    check(
      '五个工具注册齐全',
      JSON.stringify(names) ===
        JSON.stringify(['get_article', 'get_site_stats', 'list_articles', 'list_projects', 'search_site']),
      names.join(', '),
    );

    const search = await client.callTool({ name: 'search_site', arguments: { query: '字体 分片' } });
    const searchOut = JSON.parse(search.content[0].text);
    check('search_site 命中字体文章', searchOut.results?.some((r) => r.path.includes('chinese-font-slicing')), `total=${searchOut.total}`);

    const article = await client.callTool({
      name: 'get_article',
      arguments: { slug: searchOut.results.find((r) => r.kind === 'article')?.path.split('/').pop() ?? 'how-this-site-is-built' },
    });
    const articleOut = JSON.parse(article.content[0].text);
    check('get_article 返回 markdown 全文', (articleOut.content ?? '').length > 500, `${(articleOut.content ?? '').length} chars`);

    const missing = await client.callTool({ name: 'get_article', arguments: { slug: 'no-such-slug' } });
    check('get_article 未命中返回 isError', missing.isError === true);

    const stats = await client.callTool({ name: 'get_site_stats', arguments: {} });
    const statsOut = JSON.parse(stats.content[0].text);
    check(
      'get_site_stats 数量自洽',
      statsOut.counts.articles >= 4 && statsOut.counts.projects >= 2 && statsOut.counts.books >= 2,
      JSON.stringify(statsOut.counts),
    );

    const reading = await client.readResource({ uri: 'xwsx://books/reading' });
    check('reading 资源可读', (reading.contents?.[0]?.text ?? '').length > 0);
  } finally {
    await client.close();
  }
}

async function withHttp() {
  console.log('http 模式：');
  const child = spawn(process.execPath, ['server.mjs', '--http'], {
    env: { ...process.env, XWSX_SITE_URL: SITE, XWSX_PORT: '8899', XWSX_RATE_LIMIT_PER_MIN: '10' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // 崩溃路径也要杀子进程——曾因 smoke 崩溃留下孤儿进程占住 8899，
  // 后续测试请求全部打到旧进程上（数据还是旧缓存），排障时极易误判
  process.on('exit', () => child.kill());
  // 等服务就绪
  await new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(async () => {
      try {
        const res = await fetch('http://127.0.0.1:8899/health');
        if (res.ok) {
          clearInterval(timer);
          resolve();
        }
      } catch {
        if (Date.now() - t0 > 10_000) {
          clearInterval(timer);
          reject(new Error('http server did not start in 10s'));
        }
      }
    }, 200);
  });

  const client = new Client({ name: 'smoke', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport('http://127.0.0.1:8899/mcp'));
  try {
    const stats = await client.callTool({ name: 'get_site_stats', arguments: {} });
    const out = JSON.parse(stats.content[0].text);
    check('http 工具调用', out.counts.articles >= 4, JSON.stringify(out.counts));

    const search = await client.callTool({ name: 'search_site', arguments: { query: 'RPA' } });
    const searchOut = JSON.parse(search.content[0].text);
    check('http search_site', (searchOut.total ?? 0) > 0);
  // 限流探测：阈值被压到 10/min（客户端已用掉 ~4 个），连发 15 个 ping 必触发 429。
  // Windows 快速连发可能 RST（fetch 抛错）——跳过不计数，慢速连发保证命中。
  let saw429 = false;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch('http://127.0.0.1:8899/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: i, method: 'ping' }),
      });
      if (res.status === 429) {
        saw429 = true;
        await res.arrayBuffer().catch(() => {});
        break;
      }
      await res.arrayBuffer().catch(() => {});
    } catch {
      // 连接级失败不等于 429，继续打
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  check('http per-IP 限流生效（压低阈值后连发出现 429）', saw429);

  } finally {
    await client.close();
    child.kill();
  }

}

try {
  await withStdio();
  await withHttp();
  console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
  process.exit(failures === 0 ? 0 : 1);
} catch (error) {
  console.error('smoke 崩溃:', error);
  process.exit(1);
}
