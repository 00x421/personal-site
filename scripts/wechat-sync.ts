/**
 * 把一篇文章推进公众号草稿箱（个人订阅号没有 API 群发，
 * 最后一步「发表」必须由站主在 mp.weixin.qq.com 手动点——刻意留的人工闸）。
 *
 *   npm run wechat -- <slug>
 *
 * 凭据：WECHAT_APP_ID / WECHAT_APP_SECRET 从环境变量读，
 * 本地可放 .env.wechat（已 gitignore，格式 KEY=VALUE）。
 * 服务器出口 IP 必须加入公众平台「IP 白名单」，否则 40164。
 *
 * 封面：优先用 OG 图（public/og/articles/<slug>.png，没有就先 npm run og），
 * 兜底站标 og.jpg；正文里的链接未认证号不可点，文末以纯文本补一次网址。
 */
import { existsSync, readFileSync } from 'node:fs';
import { buildArticle } from '../lib/markdown.ts';
import { splitFrontmatter } from '../lib/content-parse.ts';
import { markdownToWechatHtml } from '../lib/wechat-html.ts';
import { createDraft, uploadMaterialImage } from '../lib/wechat.ts';
import { siteDescription, siteIdentity } from '../lib/site-content.ts';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnvFile('.env.wechat');

const slug = process.argv[2];
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('用法：npm run wechat -- <slug>');
  process.exit(1);
}

const file = `content/articles/${slug}.md`;
if (!existsSync(file)) {
  console.error(`找不到 ${file}`);
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const article = buildArticle(slug, raw);
const { body } = splitFrontmatter(raw);
if (article.draft) {
  console.warn('⚠ 这篇文章是 draft，站上看不到——确认你真的想把它推进公众号草稿箱');
}

// 封面：OG 图 > 站标兜底
let cover = `public/og/articles/${slug}.png`;
if (!existsSync(cover)) {
  console.warn(`⚠ 缺 ${cover}（可先跑 npm run og），改用站标 og.jpg 兜底`);
  cover = 'public/og.jpg';
}

// 文末尾签：正文链接未认证号不可点，网址以纯文本再给一次
const tail =
  `<p style="margin:26px 0 0;padding-top:14px;border-top:1px dashed #e5e2da;` +
  `font-size:12.5px;color:#8a877e;">原文收录在 <span style="color:#6355ce;">xwsx.top</span>` +
  `（信我所行）——${siteDescription}。</p>`;

console.log('上传封面素材…');
const coverMediaId = await uploadMaterialImage(cover);

console.log('推进草稿箱…');
try {
  const mediaId = await createDraft({
    title: article.title,
    digest: article.description || article.title,
    contentHtml: markdownToWechatHtml(body) + tail,
    coverMediaId,
    sourceUrl: `https://xwsx.top/articles/${slug}`,
    author: siteIdentity.name,
  });
  console.log(`\n✓ 草稿已推进（media_id: ${mediaId}）`);
  console.log('  下一步：打开 mp.weixin.qq.com → 内容管理 → 草稿箱 → 预览 / 发表。');
  console.log('  建议先用「预览」发到自己微信看一遍排版（代码块与链接的观感）。');
} catch (error) {
  console.error(`\n✗ ${(error as Error).message}`);
  console.error('  常见排查：40164 = 服务器 IP 不在公众号「IP 白名单」；40125 = AppSecret 不对。');
  process.exit(1);
}
