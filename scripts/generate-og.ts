/**
 * 构建时生成文章 OG 分享图（1200x630）。
 *
 * 用 satori 渲染 SVG、@resvg/resvg-js 转 PNG，输出到 public/og/articles/{slug}.png。
 * 数据源是 content/articles/*.md（本脚本在纯 Node 下运行，直接 fs 读取，
 * 与站点的 Vite glob 加载共享 lib/markdown.ts 的解析逻辑）。
 * 源字体沿用 subset-fonts.py 的约定：
 *   1. python subset-fonts.py 的前置步骤会从
 *      https://github.com/notofonts/noto-cjk/tree/main/Serif/SubsetOTF/SC
 *      下载 NotoSerifSC-{Regular,Medium,Bold}.otf 到 %TEMP%/noto-src/
 *   2. node scripts/generate-og.ts
 *
 * 新增文章后重新运行即可（npm run og）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createElement } from 'react';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { buildArticle, type Article } from '../lib/markdown.ts';
import { siteIdentity } from '../lib/site-content.ts';

const CONTENT_DIR = path.resolve('content', 'articles');

const articles: Article[] = readdirSync(CONTENT_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) =>
    buildArticle(
      file.replace(/\.md$/, ''),
      readFileSync(path.join(CONTENT_DIR, file), 'utf8'),
    ),
  )
  .filter((article) => !article.draft)
  .sort((a, b) => b.published.localeCompare(a.published));

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 88;

const FONT_DIR = process.env.NOTO_SRC_DIR ?? path.join(tmpdir(), 'noto-src');
const OUT_DIR = path.resolve('public', 'og', 'articles');

const COLORS = {
  paper: '#f4f2ec',
  ink: '#17171b',
  violet: '#7867e8',
  muted: '#63625c',
};

const FONT_FILES: { weight: 400 | 500 | 700; file: string }[] = [
  { weight: 400, file: 'NotoSerifSC-Regular.otf' },
  { weight: 500, file: 'NotoSerifSC-Medium.otf' },
  { weight: 700, file: 'NotoSerifSC-Bold.otf' },
];

/** 按字符数截断（中文为主，标题约 15 字/行、描述约 33 字/行）。 */
function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}.${m}.${d}`;
}

function card(article: (typeof articles)[number]) {
  const title = clamp(article.title, 28);
  const description = clamp(article.description, 66);
  const tags = article.tags.map((tag) =>
    createElement(
      'div',
      {
        key: tag,
        style: {
          display: 'flex',
          alignItems: 'center',
          padding: '10px 22px',
          border: `2px solid ${COLORS.violet}`,
          borderRadius: '999px',
          color: COLORS.violet,
          fontSize: 24,
          fontWeight: 500,
        },
      },
      tag,
    ),
  );

  return createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: `${PAD}px`,
        backgroundColor: COLORS.paper,
        color: COLORS.ink,
        fontFamily: 'Noto Serif SC',
      },
    },
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: '100%',
        },
      },
      createElement(
        'div',
        { style: { display: 'flex', alignItems: 'baseline', gap: 14 } },
        createElement(
          'span',
          { style: { fontSize: 30, fontWeight: 700, color: COLORS.violet } },
          siteIdentity.brand,
        ),
        createElement(
          'span',
          { style: { fontSize: 26, fontWeight: 500, color: COLORS.muted } },
          siteIdentity.motto,
        ),
      ),
      createElement(
        'span',
        { style: { fontSize: 24, fontWeight: 500, color: COLORS.muted } },
        '文章',
      ),
    ),
    createElement('div', {
      style: {
        width: 100,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.violet,
        marginTop: 34,
      },
    }),
    createElement(
      'div',
      {
        style: {
          marginTop: 30,
          fontSize: 62,
          lineHeight: 1.32,
          fontWeight: 700,
          letterSpacing: 1,
          maxWidth: WIDTH - PAD * 2,
        },
      },
      title,
    ),
    createElement(
      'div',
      {
        style: {
          marginTop: 26,
          fontSize: 28,
          lineHeight: 1.55,
          fontWeight: 400,
          color: COLORS.muted,
          maxWidth: WIDTH - PAD * 2,
        },
      },
      description,
    ),
    createElement(
      'div',
      {
        style: {
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        },
      },
      createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 18 } },
        createElement(
          'span',
          { style: { fontSize: 24, fontWeight: 500, color: COLORS.ink } },
          dateLabel(article.published),
        ),
        createElement(
          'span',
          { style: { fontSize: 24, fontWeight: 400, color: COLORS.muted } },
          `· ${article.readTime}`,
        ),
      ),
      createElement('div', { style: { display: 'flex', gap: 12 } }, tags),
    ),
  );
}

async function loadFonts() {
  return Promise.all(
    FONT_FILES.map(async ({ weight, file }) => ({
      name: 'Noto Serif SC',
      data: await readFile(path.join(FONT_DIR, file)),
      weight,
      style: 'normal' as const,
    })),
  );
}

async function main() {
  let fonts;
  try {
    fonts = await loadFonts();
  } catch {
    console.error(
      `缺少源字体（${FONT_DIR}）。请先按 subset-fonts.py 顶部说明下载 ` +
        'NotoSerifSC-{Regular,Medium,Bold}.otf 到该目录，' +
        '或设置环境变量 NOTO_SRC_DIR 指向字体目录。',
    );
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  for (const article of articles) {
    const svg = await satori(card(article), {
      width: WIDTH,
      height: HEIGHT,
      fonts,
    });
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: WIDTH },
    })
      .render()
      .asPng();
    const out = path.join(OUT_DIR, `${article.slug}.png`);
    await writeFile(out, png);
    console.log(`og: ${article.slug}.png`);
  }
  console.log(`\nDone: ${articles.length} images -> ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
