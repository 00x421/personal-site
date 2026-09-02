/**
 * 首页展示数据：精选项目与能力清单。
 */
export type HomeProject = {
  title: string;
  type: string;
  year: string;
  summary: string;
  tags: string[];
  /** 卡片配色主题 */
  tone: 'ink' | 'violet' | 'lime';
  mark: string;
};

export const homeProjects: HomeProject[] = [
  {
    title: 'Flowbase',
    type: '产品设计',
    year: '2026',
    summary: '把零散的客户反馈归纳成可执行的产品决策，让研究从资料库走向下一步行动。',
    tags: ['研究系统', 'AI 工作流'],
    tone: 'ink',
    mark: '01',
  },
  {
    title: 'Kite Notes',
    type: '开发实践',
    year: '2025',
    summary: '面向独立创作者的轻量写作工具：更少打断，更快从想法抵达发布。',
    tags: ['React', '体验设计'],
    tone: 'violet',
    mark: '02',
  },
  {
    title: 'Atlas Studio',
    type: '数据产品',
    year: '2025',
    summary: '将复杂运营指标沉淀成人人看得懂、每周都能用的增长工作台。',
    tags: ['数据可视化', '前端工程'],
    tone: 'lime',
    mark: '03',
  },
];

export const homeSkills: Array<[name: string, description: string]> = [
  ['产品与体验', '从问题定义、用户研究到信息架构与交互原型。'],
  ['前端开发', 'React / TypeScript / Next.js，关注细节，也在意长期可维护性。'],
  ['AI 应用', '将 LLM 放进真实的工作流，提升创造力而不是制造噪音。'],
];
