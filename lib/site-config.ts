/**
 * 站点全局配置 —— 品牌、联系方式、社交链接等统一在这里修改，
 * 所有页面从这里读取，避免占位信息散落各处。
 */
export const siteConfig = {
  /** 站点品牌名：信我所行 */
  brand: 'XWSX',
  brandMotto: '信我所行',
  /** 作者姓名 */
  name: 'Linling Qi',
  title: 'XWSX — 信我所行',
  description: 'XWSX（信我所行）— 产品、设计与代码交汇处的个人作品集。',
  email: 'techlocker@163.com',
  socials: {
    github: 'https://github.com/00x421',
    /** GitHub 用户名（页脚展示用） */
    githubUser: '00x421',
  },
  role: '软件工程师 · 产品构建者',
  year: 2026,
} as const;

export type SiteConfig = typeof siteConfig;
