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

export const projects = [
  {
    title: 'Flowbase',
    type: '产品设计',
    year: '2026',
    summary:
      '把零散的客户反馈归纳成可执行的产品决策，让研究从资料库走向下一步行动。',
    tags: ['研究系统', 'AI 工作流'],
    tone: 'ink',
    mark: '01',
    status: '案例整理中',
    slug: null,
  },
  {
    title: 'Spider King',
    type: '开发实践',
    year: '2026',
    summary:
      '把网页里依赖浏览器的复杂请求，恢复成可独立运行、可验证的 Python 采集程序。',
    tags: ['Python-first', '协议恢复'],
    tone: 'violet',
    mark: 'SK',
    status: '查看案例',
    slug: 'spider-king',
  },
  {
    title: 'Atlas Studio',
    type: '数据产品',
    year: '2025',
    summary: '将复杂运营指标沉淀成人人看得懂、每周都能用的增长工作台。',
    tags: ['数据可视化', '前端工程'],
    tone: 'lime',
    mark: '03',
    status: '案例整理中',
    slug: null,
  },
] as const;

export const projectCases = {
  'spider-king': {
    title: 'Spider King',
    type: '开发实践',
    year: '2026',
    eyebrow: 'PROTOCOL-FIRST ENGINEERING SKILL',
    summary:
      '将原本依赖浏览器环境的复杂 Web 请求，恢复成可独立运行、可验证的 Python 采集程序。',
    context:
      '面向自有系统、已授权平台、安全测试与教学研究场景。项目不把“能在网页里跑通”视为终点，而是要求最终交付脱离浏览器、可重复验证。',
    challenge:
      '复杂目标的难点，往往不只是一个 sign。真实变化可能藏在请求包装、旋转 Cookie、服务端 bootstrap、响应解码或长连接状态里；一次成功的重放，也不等于可维护的采集方案。',
    stages: [
      [
        '先确认真实链路',
        '以页面状态和网络证据为起点，区分表面接口、真实请求与中间包装层。',
      ],
      [
        '拆解动态状态',
        '把签名、时间戳、Cookie、会话、解码与传输封装分别验证，不把所有问题归为“浏览器环境”。',
      ],
      [
        '离线重建与交付',
        '优先交付纯 Python；只有确有必要时，保留极小、无 DOM 依赖的本地 JS 或 WASM helper。',
      ],
    ],
    principles: [
      '证据优先，而不是猜测参数名',
      '协议优先，而不是把浏览器自动化当交付',
      '先验证单个稳定请求，再处理分页与规模化',
      '把已授权边界和不稳定因素写进交付说明',
    ],
    deliverables: [
      '启动分流与环境检查',
      '请求 / 响应样本对比工具',
      '协议采集项目脚手架',
      '按症状路由的工作手册',
    ],
  },
} as const;

export function getProjectCase(slug: string) {
  return projectCases[slug as keyof typeof projectCases];
}

export const skills = [
  ['产品与体验', '从问题定义、用户研究到信息架构与交互原型。'],
  ['前端开发', 'React / TypeScript / Next.js，关注细节，也在意长期可维护性。'],
  ['AI 应用', '将 LLM 放进真实的工作流，提升创造力而不是制造噪音。'],
] as const;
