import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { MailLink } from '@/components/site/mail-link';
import { siteIdentity } from '@/lib/site-content';

export const metadata: Metadata = {
  title: '此刻 — XWSX',
  description: '我此刻正在专注、探索和阅读的东西——一页纸的当下状态。',
  alternates: { canonical: '/now' },
};

const nowBlocks = [
  {
    label: 'FOCUS / 正在专注',
    items: [
      '打磨这个个人站 XWSX：React 19 服务端组件、Cloudflare Workers 边缘部署、无障碍与性能细节。',
      '把 Flowbase 与 Atlas Studio 的项目复盘整理成可读的案例文章。',
    ],
  },
  {
    label: 'EXPLORING / 正在探索',
    items: [
      'View Transitions 与新一代 CSS 动画能力。',
      '把 LLM 放进真实工作流的边界：哪里该交给模型，哪里必须留下控制权。',
    ],
  },
  {
    label: 'READING / 最近在读',
    items: [
      '重读《设计心理学》：把复杂系统的可发现性拆成可执行的原则。',
      '在读《认知觉醒》：耐心是一种可以刻意练习的技能。',
      '在读《被讨厌的勇气》：课题分离，先把自己活明白。',
    ],
  },
  {
    label: 'SITE / 站点状态',
    items: ['本页更新于 2026 年 9 月。站点仍在持续迭代，欢迎订阅 RSS 追踪新文章。'],
  },
];

export default function NowPage() {
  return (
    <main className="article-page">
      <div className="article-shell">
        <Link href="/#top" className="back-link">
          <ArrowLeft size={15} /> 返回首页
        </Link>
        <header className="article-index-head">
          <span className="section-index">NOW / 2026-09</span>
          <h1>
            此刻在做什么，
            <br />
            <em>如实写下来。</em>
          </h1>
          <p>
            一页纸的当下状态：专注、探索与阅读。更新不算频繁，但每次都是真的。
          </p>
        </header>
        <div className="now-list">
          {nowBlocks.map((block) => (
            <section className="now-block" key={block.label}>
              <span className="section-index">{block.label}</span>
              <ul>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="now-actions">
          <Link href="/rss.xml">
            订阅 RSS <ArrowUpRight size={14} className="now-icon" />
          </Link>
          <MailLink email={siteIdentity.email} copiedText="邮箱已复制">
            写信给我
          </MailLink>
          <a
            href="https://nownownow.com/about"
            target="_blank"
            rel="noreferrer noopener"
          >
            这是什么？
          </a>
        </div>
      </div>
    </main>
  );
}
