/**
 * 把导航吉祥物从 LaoA-GrokBot 的矢量数据渲染成 PNG 母版。
 *
 * 角色来源：老A玩AI（zhulin025/LaoA-GrokBot，MIT License）的 GrokBot 形象。
 * 该项目的角色由代码绘制（canvas Path2D / 内联 SVG），没有位图可拿，
 * 所以这里直接读它的 original-data.js 表情环数据 + index.html 的身体路径，
 * 拼成静态 SVG 后用 @resvg/resvg-js 渲染——不依赖浏览器，可复现。
 *
 * 用法：node scripts/capture-grokbot.mjs [GrokBot仓库路径]
 *   默认路径 D:/vibe coding/CK/LaoA-GrokBot（本机克隆位置）。
 * 输出：images-src/grokbot/grokbot-expr-<n>.png（512px 母版，gitignore），
 *       之后用 PIL 修剪成 192px WebP 放进 public/（见文件末尾注释）。
 *
 * 站点四个状态的候选表情来自原版的 POOLS：
 *   idle → 0, 8        thinking → 8,16,14,17,5
 *   happy → 2,11,17,19 sleeping → 13,22,4
 * 全部候选都渲染出来，由人眼挑选，不做自动选择。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { Resvg } from '@resvg/resvg-js';

const SOURCE_REPO = process.argv[2] ?? 'D:/vibe coding/CK/LaoA-GrokBot';
const OUT_DIR = 'images-src/grokbot';

/** GrokBot 角色配色（取站点 --violet 明暗两值之间的「梦幻紫」）与眼白（--card）。 */
const BOT_COLOR = '#8656f6';
const EYE_COLOR = '#fffdf7';

/** index.html 的 blob 身体路径（customizer.js GROKBOT_SHAPES[0] 同源）。 */
const BLOB_PATH =
  'M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z';

/** 身体部件（enhancements.css 默认隐藏，这里按「天线+手脚+尾巴」全开组合），
    同 index.html 的 DOM 顺序；描边参数照抄 enhancements.css 的 .body-part。 */
const BODY_PARTS = `
<g class="body-part" id="part-antenna"><path d="M114 18V-5"/><circle cx="114" cy="-12" r="8"/></g>
<g class="body-part" id="part-tail"><path d="M205 154C246 151 254 181 230 198C216 208 214 220 227 228"/></g>
<g class="body-part" id="part-hands"><g id="hand-left"><path d="M25 132C5 136-8 148-17 165"/><circle cx="-20" cy="170" r="10"/></g><g id="hand-right"><path d="M204 132C224 136 237 148 246 165"/><circle cx="249" cy="170" r="10"/></g></g>
<g class="body-part" id="part-feet"><path d="M72 202V224"/><ellipse cx="62" cy="230" rx="24" ry="10"/><path d="M157 202V224"/><ellipse cx="167" cy="230" rx="24" ry="10"/></g>`;

/** 与 app.js 的 path() 一致：环点列 → SVG path d。 */
function ringToPath(ring) {
  return (
    'M' +
    ring.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L') +
    'Z'
  );
}

async function loadData() {
  const code = await readFile(path.join(SOURCE_REPO, 'original-data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox, { filename: 'original-data.js' });
  return sandbox.window.GROKBOT_ORIGINAL;
}

function botSvg(data, expressionIndex) {
  const [eye0, eye1] = data.EXPRESSIONS[expressionIndex];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-34 -34 296 296">
<defs><clipPath id="head-clip"><path d="${BLOB_PATH}"/></clipPath></defs>
<g fill="none" stroke="${BOT_COLOR}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${BODY_PARTS}</g>
<path d="${BLOB_PATH}" fill="${BOT_COLOR}"/>
<g clip-path="url(#head-clip)">
  <path d="${ringToPath(eye0)}" fill="${EYE_COLOR}"/>
  <path d="${ringToPath(eye1)}" fill="${EYE_COLOR}"/>
</g>
</svg>`;
}

async function renderPng(svg, outFile) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } })
    .render()
    .asPng();
  await writeFile(outFile, png);
}

const data = await loadData();
await mkdir(OUT_DIR, { recursive: true });

/** @type {[string, number[]][]} */
const candidates = [
  ['idle', [0, 8]],
  ['thinking', [8, 16, 14, 17, 5]],
  ['happy', [2, 11, 17, 19]],
  ['sleeping', [13, 22, 4]],
];
for (const [state, exprs] of candidates) {
  for (const expr of exprs) {
    await renderPng(
      botSvg(data, expr),
      path.join(OUT_DIR, `grokbot-${state}-expr-${String(expr).padStart(2, '0')}.png`),
    );
  }
}
console.log(`done -> ${OUT_DIR}/`);

/* 后续收尾（手工执行一次）：
   python -c "修剪透明边 + 缩到 192px + 存 public/ 的 WebP"，见会话记录或 README。 */
