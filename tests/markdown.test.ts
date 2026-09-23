import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildArticle, buildProject } from '../lib/markdown.ts';

/**
 * Markdown 渲染管线的测试。
 *
 * 这个文件此前**不存在**，而且当时的判断是「补不了」——HANDOFF 与 README 都把
 * `lib/markdown.ts` 归到「只有 Vite 能跑」那一层。**那个判断是错的**：它不碰
 * `import.meta.glob`，`node --experimental-strip-types --test` 下能正常导入
 * （marked 与 prismjs 都能加载）。真正不可测的只有 `data/*.ts`。
 *
 * 于是这里补上站点上最容易出错、又最没人看着的一环：frontmatter → HTML。
 * 起因是修「标签重复计数」时需要断言解析层的去重，顺手把同模块的几条硬不变量
 * 也固化下来（代码块要有 data-lang、表格要包滚动容器、draft/hasCase 的判定）。
 */

function articleRaw(frontmatter: string[], body: string[] = []) {
  return ['---', ...frontmatter, '---', '', ...body].join('\n');
}

describe('buildArticle · frontmatter', () => {
  it('缺少 frontmatter 时回退到 slug 与空值', () => {
    const article = buildArticle('some-slug', '只有正文');
    assert.equal(article.slug, 'some-slug');
    assert.equal(article.title, 'some-slug');
    assert.equal(article.description, '');
    assert.equal(article.published, '');
    assert.deepEqual(article.tags, []);
    assert.equal(article.draft, false);
  });

  it('重复标签在解析层去重，且保持首次出现的顺序', () => {
    // 行为变更（2026-09-23）：去重放在解析层而不是 collectTags 里，是为了让
    // 所有下游（标签云、RSS 的 category、搜索索引、文章页标签片、标签页）
    // 一次全部正确，而不是每处各修一遍。
    const article = buildArticle(
      'x',
      articleRaw(['title: T', 'tags: [设计, 前端, 设计, 设计]']),
    );
    assert.deepEqual(article.tags, ['设计', '前端']);
  });

  it('draft 只在字面量 true 时生效（缺省与 false 都不算草稿）', () => {
    assert.equal(buildArticle('x', articleRaw(['draft: true'])).draft, true);
    assert.equal(buildArticle('x', articleRaw(['draft: false'])).draft, false);
    assert.equal(buildArticle('x', articleRaw(['title: T'])).draft, false);
  });

  it('阅读时长由正文算出，不含 frontmatter', () => {
    // description 里的字不该被算进正文
    const article = buildArticle(
      'x',
      articleRaw(['description: ' + '字'.repeat(2000)], ['短正文']),
    );
    assert.equal(article.readTime, '1 min read');
  });
});

describe('buildArticle · 正文渲染', () => {
  it('代码块渲染成带 data-lang 的 pre，供复制按钮增强', () => {
    const article = buildArticle('x', articleRaw([], ['```ts', 'const a = 1;', '```']));
    assert.match(article.html, /<pre data-lang="ts">/);
    assert.match(article.html, /<code>/);
  });

  it('无语言标注的代码块回退为 text', () => {
    const article = buildArticle('x', articleRaw([], ['```', 'plain', '```']));
    assert.match(article.html, /<pre data-lang="text">/);
  });

  it('代码块内容被 Prism 高亮成带 class 的 token', () => {
    const article = buildArticle('x', articleRaw([], ['```python', 'def f():', '    pass', '```']));
    // 至少有一个 token span；具体 class 名由 Prism 主题决定，不锁死
    assert.match(article.html, /<span class="token/);
  });

  it('表格被包进 .table-scroll 容器（窄屏横向滚动，服务端处理、无需 JS）', () => {
    const article = buildArticle(
      'x',
      articleRaw([], ['| a | b |', '| - | - |', '| 1 | 2 |']),
    );
    assert.match(article.html, /<div class="table-scroll"><table>/);
    assert.match(article.html, /<\/table>\s*<\/div>/);
    // 表格本体没有被破坏：表头与表体都在
    assert.match(article.html, /<thead>/);
    assert.match(article.html, /<tbody>/);
  });

  it('裸的尖括号被转义（正文里写 a < b 不会被当成标签）', () => {
    const article = buildArticle('x', articleRaw([], ['比较 a < b 与 c > d']));
    assert.match(article.html, /a &lt; b/);
    assert.match(article.html, /c &gt; d/);
  });

  it('正文里的原始 HTML 会原样通过（第一方内容的刻意选择，不是漏洞）', () => {
    // marked 不消毒，lib/markdown.ts 的 Article 类型上写明「站点内容为第一方撰写，
    // 无需消毒」。把这条行为锁住，是为了它变成**显式契约**：
    // 一旦将来引入外部内容（评论、第三方投稿），这里必须先加消毒。
    const article = buildArticle('x', articleRaw([], ['正文里的 <script> 字样']));
    assert.match(article.html, /<script>/);
  });
});

describe('buildProject', () => {
  it('只有 frontmatter 时 hasCase 为 false、状态回退为「案例整理中」', () => {
    const project = buildProject('p', articleRaw(['title: P', 'type: 产品设计']));
    assert.equal(project.hasCase, false);
    assert.equal(project.html, '');
    assert.equal(project.status, '案例整理中');
  });

  it('有正文时 hasCase 为 true、状态回退为「查看案例」', () => {
    const project = buildProject('p', articleRaw(['title: P'], ['## 背景', '正文']));
    assert.equal(project.hasCase, true);
    assert.equal(project.status, '查看案例');
    assert.match(project.html, /<h2/);
  });

  it('只含 HTML 注释的正文不算案例内容', () => {
    const project = buildProject('p', articleRaw(['title: P'], ['<!-- 待补 -->']));
    assert.equal(project.hasCase, false);
  });

  it('重复标签同样去重（与文章走同一条解析路径）', () => {
    const project = buildProject('p', articleRaw(['tags: [A, A, B]']));
    assert.deepEqual(project.tags, ['A', 'B']);
  });

  it('未知 tone 回退为 ink（避免出现没有配色的卡片）', () => {
    assert.equal(buildProject('p', articleRaw(['tone: 随便'])).tone, 'ink');
    assert.equal(buildProject('p', articleRaw(['tone: violet'])).tone, 'violet');
    assert.equal(buildProject('p', articleRaw(['tone: lime'])).tone, 'lime');
  });

  it('order 缺失或非法时回退为 99（排在最后，而不是排最前）', () => {
    assert.equal(buildProject('p', articleRaw([])).order, 99);
    assert.equal(buildProject('p', articleRaw(['order: 不成数字'])).order, 99);
    assert.equal(buildProject('p', articleRaw(['order: 3'])).order, 3);
  });

  it('meta 缺省时回退为 [type]', () => {
    assert.deepEqual(buildProject('p', articleRaw(['type: 开发实践'])).meta, ['开发实践']);
    assert.deepEqual(
      buildProject('p', articleRaw(['type: 开发实践', 'meta: [A, B]'])).meta,
      ['A', 'B'],
    );
  });

  it('deliverables 支持块列表写法', () => {
    const project = buildProject(
      'p',
      articleRaw(['deliverables:', '  - 交付物一', '  - 交付物二']),
    );
    assert.deepEqual(project.deliverables, ['交付物一', '交付物二']);
  });
});
