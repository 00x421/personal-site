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
  ['#stack', '能力'],
  ['#writing', '文章'],
] as const;

/**
 * 04 区的四条能力范围。
 *
 * 只写「做什么 + 判断标准」。**不要写案例、不要链文章**——
 * 一旦带情节，它就退化成 02 文章区的目录（这个错犯过一次）。
 * 情节属于文章，这里只负责 15 秒能扫完的范围速览。
 *
 * 前两条是主攻方向（focus: true）：排在前面，并带一个视觉标记。
 */
type Capability = {
  name: string;
  /** 主攻方向：排在最前，标题旁显示标记 */
  focus?: boolean;
  detail: string;
};

export const capabilities: readonly Capability[] = [
  {
    name: '自动化',
    focus: true,
    detail:
      '把重复的流程交给机器：RPA、接口编排、AI Agent 三类都做。交付标准是它能在没有人盯着的情况下长期跑下去。',
  },
  {
    name: '方案与拆解',
    focus: true,
    detail:
      '面对没有现成答案的问题，先摸清真实链路再动手：分清哪些是表面现象、哪一环才是真正在变的，然后只解决后者。',
  },
  {
    name: '全栈实现',
    detail:
      'React / TypeScript / Python。从界面、构建链到部署，这一整条路都在范围内。',
  },
  {
    name: '产品与体验',
    detail: '从问题定义、信息架构到可点原型，一路跟到上线。',
  },
];

/**
 * 04 区底部：按真实使用深度分组，只分两级。
 * 把「用过」和「常用」并列成一张名单，等于说它们一样熟——那是不诚实的。
 *
 * 排列逻辑：语言在前，然后按「采集 → 自动化 → Agent → 编排 → 数据」聚类。
 * 允许语义上有重叠（如 DrissionPage 与数据采集）：技术名词对不懂的人是黑箱，
 * 平实的能力描述反而更好读，这份清单也要服务非技术读者。
 */
export const toolbox: readonly (readonly [string, readonly string[]])[] = [
  [
    '熟练',
    [
      'TypeScript',
      'React',
      'Node',
      'Python',
      'DrissionPage',
      'RPA',
      'Agent 构建',
      'Skills 编写',
      '工作流设计',
      '数据采集',
    ],
  ],
  ['在学', ['MCP', 'Agent 评测', '视觉定位自动化']],
];
