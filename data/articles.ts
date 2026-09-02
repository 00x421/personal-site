export type Article = {
  slug: string;
  title: string;
  description: string;
  published: string;
  readTime: string;
  tags: string[];
  body: { heading: string; paragraphs: string[] }[];
};

export const articles: Article[] = [
  {
    slug: 'build-small-systems',
    title: '先把系统做小，再把价值做大',
    description: '关于我如何拆解复杂需求，用一个可以被验证的小闭环开始产品工作。',
    published: '2026-08-18',
    readTime: '1 min read',
    tags: ['产品思考', '工程实践'],
    body: [
      { heading: '复杂不是功能多', paragraphs: ['很多项目一开始就试图覆盖所有场景，但复杂度往往来自没有找到最小的因果链。我的习惯是先写下用户要完成的唯一一件事，再删掉所有不能帮助这件事完成的内容。', '当这个小闭环可以被真实使用，团队才有了继续投入的证据。'] },
      { heading: '让反馈回到系统里', paragraphs: ['好的迭代不是不断堆叠选项，而是把反馈变成下一次决策。每一个版本都应该留下可观察的信号：哪里被使用，哪里被跳过，哪里让人犹豫。'] },
    ],
  },
  {
    slug: 'ai-in-real-workflows',
    title: 'AI 应该藏在工作流里，而不是站在聚光灯下',
    description: '从一次真实的产品实验出发，记录我对 AI 功能边界、提示词和信任感的思考。',
    published: '2026-07-04',
    readTime: '1 min read',
    tags: ['AI 应用', '产品设计'],
    body: [
      { heading: '先理解人如何工作', paragraphs: ['AI 功能最容易失败的地方，是把模型能力当成了用户价值。真正要观察的是：用户在什么时刻卡住，哪些信息已经在他们手边，系统可以替他们减少哪一次切换。'] },
      { heading: '把不确定性说清楚', paragraphs: ['我更愿意让系统展示依据、允许编辑，并在不确定时主动承认边界。信任不是一个漂亮的加载动画，而是用户始终知道下一步可以做什么。'] },
    ],
  },
  {
    slug: 'frontend-details-that-matter',
    title: '前端细节不是装饰，是产品的一部分',
    description: '从键盘焦点、加载状态到错误文案，聊聊我认为值得认真对待的前端细节。',
    published: '2026-05-22',
    readTime: '1 min read',
    tags: ['前端开发', '可访问性'],
    body: [
      { heading: '细节决定节奏', paragraphs: ['一个按钮是否有明确的按下反馈，一段空状态是否告诉用户如何开始，都会改变产品给人的节奏感。它们不显眼，却一直在影响体验。'] },
      { heading: '把可访问性当作默认值', paragraphs: ['语义化 HTML、清晰的焦点状态和足够的颜色对比，不应该在最后才补上。它们让更多人可以使用产品，也让代码本身更容易维护。'] },
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}
