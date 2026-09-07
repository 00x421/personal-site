export const siteIdentity = {
  brand: 'XWSX',
  name: 'Linling Qi',
  email: 'techlocker@163.com',
  github: 'https://github.com/00x421',
  motto: '信我所行',
} as const;

export const siteNavigation = [
  ['#work', '项目'],
  ['#about', '关于'],
  ['#stack', '技术'],
  ['#writing', '文章'],
] as const;

/** 04 区技能分组：名称 + 一句话定位 + 可横向扩展的技术徽章 */
export const skillGroups = [
  {
    name: '产品与体验',
    tagline: '从问题定义到可用的界面。',
    items: ['产品思维', '用户研究', '信息架构', '交互原型', '设计系统'],
  },
  {
    name: '前端开发',
    tagline: '关注细节，也在意长期可维护性。',
    items: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'RSC', '性能优化'],
  },
  {
    name: 'AI 与自动化',
    tagline: '让 LLM 和流程替人干活。',
    items: ['LLM 应用', 'AI Agent', 'RPA', 'AI Workflow', '提示工程'],
  },
  {
    name: '工程素养',
    tagline: '上线之后才算做完。',
    items: ['无障碍', 'SEO', '监控告警', 'CI/CD', '文档沉淀'],
  },
] as const;
