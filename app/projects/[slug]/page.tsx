import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getProjectCase, projectCases } from '@/lib/site-content';

export function generateStaticParams() {
  return Object.keys(projectCases).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectCase(slug);
  if (!project) return { title: '项目不存在 — XWSX' };
  return {
    title: `${project.title} — XWSX`,
    description: project.summary,
    alternates: { canonical: `/projects/${slug}` },
    openGraph: {
      title: project.title,
      description: project.summary,
      images: [],
    },
    twitter: { images: [] },
  };
}

export default async function ProjectCasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectCase(slug);
  if (!project) notFound();

  return (
    <main className="project-case-page">
      <div className="project-case-shell">
        <Link href="/#work" className="back-link">
          <ArrowLeft size={15} /> 所有项目
        </Link>
        <article className="project-case">
          <header className="project-case-hero">
            <span className="case-eyebrow">{project.eyebrow}</span>
            <div className="case-title-row">
              <h1>{project.title}</h1>
              <span>{project.year}</span>
            </div>
            <p>{project.summary}</p>
            <div className="case-meta">
              <span>{project.type}</span>
              <span>已授权场景</span>
              <span>Python-first</span>
            </div>
          </header>
          <section className="case-intro">
            <span className="section-index">01 / 背景</span>
            <p>{project.context}</p>
          </section>
          <section className="case-section">
            <span className="section-index">02 / 问题</span>
            <div>
              <h2>不是“把页面点通”，而是让协议可复现。</h2>
              <p>{project.challenge}</p>
            </div>
          </section>
          <section className="case-section">
            <span className="section-index">03 / 方法</span>
            <div className="case-stages">
              {project.stages.map(([title, description], index) => (
                <article key={title}>
                  <span>0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="case-section case-two-column">
            <span className="section-index">04 / 原则与产物</span>
            <div>
              <ul className="case-principles">
                {project.principles.map((principle) => (
                  <li key={principle}>
                    <Check size={16} /> {principle}
                  </li>
                ))}
              </ul>
              <div className="case-deliverables">
                {project.deliverables.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </section>
        </article>
        <Link href="/#work" className="article-end-link">
          回到项目 <ArrowUpRight size={17} />
        </Link>
      </div>
    </main>
  );
}
