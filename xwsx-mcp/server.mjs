/**
 * xwsx.top 的 MCP server —— 让任何 MCP 客户端（Claude 等）搜索与阅读站点内容。
 *
 * 只读、纯数据返回：工具只做内存数组上的检索与格式化，零 LLM 调用、
 * 零文件系统访问、零外部 fetch（数据来自站点的公开 /api/content + TTL 缓存）。
 * 站点侧的 draft 过滤是唯一内容闸门（与页面/RSS/搜索同源）。
 *
 * 两种传输：
 *   node server.mjs            → stdio（Claude Desktop / Claude Code 本地配置）
 *   node server.mjs --http     → Streamable HTTP，绑定 127.0.0.1:$XWSX_PORT(8899)，
 *                                stateless 模式（每请求独立处理，无需会话），带 per-IP 限流
 *
 * 环境变量：XWSX_SITE_URL（数据源，默认 https://xwsx.top）、
 *          XWSX_CACHE_TTL_MS、XWSX_PORT（HTTP 模式端口）、
 *          XWSX_RATE_LIMIT_PER_MIN（HTTP 模式 per-IP 限流，默认 60）。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { createServer as createHttpServer } from 'node:http';
import { getData, siteUrl } from './data.mjs';

const SERVER_INFO = { name: 'xwsx-site', version: '0.1.0' };
const SITE_INSTRUCTIONS =
  'xwsx.top 的内容工具集（信我所行 —— 产品、设计与代码的个人站点）。' +
  'search_site 做关键词检索，get_article 读单篇全文（markdown），' +
  'list_articles / list_projects 列目录，get_site_stats 给站点概览。';

// ---- 工具实现（纯内存数据运算） -------------------------------------------

/** 多词 AND 加权评分：title 6 / tags 4 / description 2 / content 1。
    与站点站内搜索（components/site/site-search.tsx）同一评分语汇。 */
function scoreDoc(doc, terms) {
  const title = doc.title.toLowerCase();
  const tags = (doc.tags ?? []).map((t) => t.toLowerCase());
  const desc = (doc.description ?? doc.summary ?? '').toLowerCase();
  const content = (doc.content ?? '').toLowerCase();
  let total = 0;
  for (const term of terms) {
    let score = 0;
    if (title.includes(term)) score += 6;
    if (tags.some((tag) => tag.includes(term))) score += 4;
    if (desc.includes(term)) score += 2;
    if (content.includes(term)) score += 1;
    if (score === 0) return 0; // AND 语义：任一词未命中即淘汰
    total += score;
  }
  return total;
}

function asText(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function asError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function searchSite({ query, limit = 8 }) {
  const data = await getData();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) {
    return asText({ error: 'query 为空', hint: '给一个或多个关键词，空格分隔' });
  }

  const scored = [];
  for (const article of data.articles) {
    const score = scoreDoc({ ...article, summary: article.description }, terms);
    if (score > 0) {
      scored.push({
        kind: 'article',
        score,
        title: article.title,
        path: `/articles/${article.slug}`,
        published: article.published,
        tags: article.tags,
        description: article.description,
      });
    }
  }
  for (const project of data.projects) {
    const score = scoreDoc({ ...project, description: project.summary }, terms);
    if (score > 0) {
      scored.push({
        kind: 'project',
        score,
        title: project.title,
        path: `/projects/${project.slug}`,
        year: project.year,
        tags: project.tags,
        description: project.summary,
      });
    }
  }
  for (const book of data.books) {
    const score = scoreDoc(
      {
        title: `书架：${book.title} ${book.author}`,
        tags: [],
        description: book.takeaway,
        content: `${book.author} ${book.status} ${book.takeaway}`,
      },
      terms,
    );
    if (score > 0) {
      scored.push({
        kind: 'book',
        score,
        title: `《${book.title}》${book.author}`,
        path: '/books',
        description: book.takeaway,
      });
    }
  }
  // 站点自述（能力范围/工具箱/联系方式）：「RPA」「怎么联系」这类查询的唯一来源
  const aboutScore = scoreDoc(
    {
      title: `关于 ${data.site.brand}（${data.site.name}）`,
      tags: [],
      description: data.site.description,
      content: data.about.capabilities.map((c) => `${c.name} ${c.detail}`).join(' ') +
        ' ' +
        data.about.toolbox.map(([level, items]) => `${level} ${items.join(' ')}`).join(' ') +
        ` ${data.about.contact.email} ${data.about.contact.github}`,
    },
    terms,
  );
  if (aboutScore > 0) {
    scored.push({
      kind: 'about',
      score: aboutScore,
      title: `关于 ${data.site.brand}（${data.site.name}）`,
      path: '/#stack',
      description: data.site.description,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return asText({
    query,
    total: scored.length,
    results: scored.slice(0, limit),
    hint: '用 get_article(path 里的 slug) 读全文',
  });
}

async function getArticle({ slug }) {
  const data = await getData();
  const article = data.articles.find((a) => a.slug === slug);
  if (article) {
    return asText({
      ...article,
      url: `${siteUrl}/articles/${article.slug}`,
    });
  }
  const project = data.projects.find((p) => p.slug === slug);
  if (project) {
    return asText({
      ...project,
      url: `${siteUrl}/projects/${project.slug}`,
      note: project.hasCase ? null : '该项目只有卡片信息，暂无案例正文',
    });
  }
  return asError(`没有找到「${slug}」。用 search_site 或 list_articles 查看可用的 slug。`);
}

async function listArticles() {
  const data = await getData();
  return asText({
    total: data.articles.length,
    articles: data.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      published: a.published,
      readTime: a.readTime,
      tags: a.tags,
      series: a.series,
      description: a.description,
    })),
  });
}

async function listProjects() {
  const data = await getData();
  return asText({
    total: data.projects.length,
    projects: data.projects.map((p) => ({
      slug: p.slug,
      title: p.title,
      type: p.type,
      year: p.year,
      status: p.status,
      hasCase: p.hasCase,
      tags: p.tags,
      summary: p.summary,
    })),
  });
}

async function getSiteStats() {
  const data = await getData();
  const latest = [...data.articles].sort((a, b) => b.published.localeCompare(a.published))[0];
  return asText({
    site: data.site,
    counts: {
      articles: data.articles.length,
      projects: data.projects.length,
      books: data.books.length,
    },
    latestArticle: latest
      ? { slug: latest.slug, title: latest.title, published: latest.published }
      : null,
    reading: data.books.filter((b) => b.status === '在读').map((b) => b.title),
    dataEndpoint: `${siteUrl}/api/content`,
  });
}

// ---- MCP server 组装 -------------------------------------------------------

function registerTools(server) {
  server.registerTool(
    'search_site',
    {
      title: '搜索站点内容',
      description:
        '按关键词搜索 xwsx.top 的文章、项目案例与书架。多关键词空格分隔（AND 语义），' +
        '返回按相关度排序的列表（标题/路径/摘要），用 get_article 读全文。',
      inputSchema: {
        query: z.string().describe('搜索关键词，空格分隔多个词'),
        limit: z.number().int().min(1).max(20).default(8).describe('返回条数上限'),
      },
    },
    searchSite,
  );

  server.registerTool(
    'get_article',
    {
      title: '读取文章/项目全文',
      description:
        '按 slug 读取一篇文章或项目案例的 markdown 全文与元数据。slug 来自 search_site / list_* 的结果。',
      inputSchema: {
        slug: z.string().describe('文章或项目的 slug，例如 how-this-site-is-built'),
      },
    },
    getArticle,
  );

  server.registerTool(
    'list_articles',
    {
      title: '列出全部文章',
      description: '列出站内全部文章（标题/日期/标签/摘要），不含正文。',
      inputSchema: {},
    },
    listArticles,
  );

  server.registerTool(
    'list_projects',
    {
      title: '列出全部项目',
      description: '列出站内全部项目案例（类型/年份/状态/摘要），不含正文。',
      inputSchema: {},
    },
    listProjects,
  );

  server.registerTool(
    'get_site_stats',
    {
      title: '站点概览',
      description: '站点身份、内容数量、最新文章、在读书目等概览信息。',
      inputSchema: {},
    },
    getSiteStats,
  );
}

function newServer() {
  const server = new McpServer(SERVER_INFO, { instructions: SITE_INSTRUCTIONS });
  registerTools(server);
  // ResourceTemplate 注册一个书架只读资源，展示资源面能力（LLM 可直接订阅）
  server.registerResource(
    'reading',
    'xwsx://books/reading',
    { title: '在读书目' },
    async (uri) => {
      const data = await getData();
      const reading = data.books.filter((b) => b.status === '在读');
      return {
        contents: [
          {
            uri: uri.href,
            text: reading
              .map((b) => `《${b.title}》${b.author} —— ${b.takeaway || '（暂无心得）'}`)
              .join('\n'),
          },
        ],
      };
    },
  );
  return server;
}

// ---- stdio 模式 ------------------------------------------------------------

async function runStdio() {
  const server = newServer();
  await server.connect(new StdioServerTransport());
  // stdio 协议走 stdin/stdout，任何 console.log 都会污染协议——保持静默
}

// ---- HTTP 模式（stateless + per-IP 限流） ----------------------------------

const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (rateBuckets.get(ip) ?? []).filter((ts) => ts > windowStart);
  if (hits.length >= Number(process.env.XWSX_RATE_LIMIT_PER_MIN ?? 60)) {
    rateBuckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 5000) {
    for (const [key, arr] of rateBuckets) {
      if (arr[arr.length - 1] <= windowStart) rateBuckets.delete(key);
    }
  }
  return false;
}

async function runHttp() {
  const port = Number(process.env.XWSX_PORT ?? 8899);
  const httpServer = createHttpServer(async (req, res) => {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, server: SERVER_INFO }));
      return;
    }
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(405, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'method-not-allowed', hint: 'POST /mcp' }));
      return;
    }
    if (rateLimited(ip)) {
      res.writeHead(429, {
        'content-type': 'application/json',
        'retry-after': '60',
      });
      res.end(JSON.stringify({ error: 'rate-limited', retryAfterSec: 60 }));
      return;
    }

    // stateless 模式每请求独立 server+transport，处理完即 close——
    // keep-alive 复用会撞上已 close 的实例（实测第二请求 ECONNRESET），
    // 显式逐请求断开，语义与 stateless 完全一致
    res.setHeader('connection', 'close');

    // JSON-RPC 请求体很小，1MB 上限防恶意大 body 耗内存
    const MAX_BODY_BYTES = 1024 * 1024;
    let body = '';
    let oversized = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        oversized = true;
        res.writeHead(413, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'payload-too-large' }));
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (oversized) return;
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid-json' }));
        return;
      }
      try {
        const server = newServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // stateless
          enableJsonResponse: true,
        });
        res.on('close', () => {
          transport.close();
          server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, parsed);
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'internal', message: error.message }));
        }
      }
    });
  });

  // 只绑回环：公网暴露一律走 nginx 反代（TLS + 限流前置）
  httpServer.listen(port, '127.0.0.1', () => {
    console.error(`[xwsx-mcp] http listening on 127.0.0.1:${port}/mcp (data: ${siteUrl})`);
  });
}

// ---- 入口 ------------------------------------------------------------------

if (process.argv.includes('--http')) {
  await runHttp();
} else {
  await runStdio();
}
