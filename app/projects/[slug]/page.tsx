import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getProject, projects } from '@/data/projects';

export function generateStaticParams() {
  return projects
    .filter((project) => project.hasCase)
    .map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project?.hasCase) return { title: '项目不存在 — XWSX' };
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
  const project = getProject(slug);
  if (!project?.hasCase) notFound();

  // 交付物分区跟在正文 h2 分区之后自动编号
  const sectionCount = (project.html.match(/<h2/g) ?? []).length;

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
              {project.meta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </header>
          {/* 正文 Markdown：h2 自动编号分区，h3 大标题，h4 小节标题 */}
          <div
            className="case-body"
            dangerouslySetInnerHTML={{ __html: project.html }}
          />
          {project.deliverables.length > 0 && (
            <section className="case-deliverables-section">
              <span className="case-deliverables-index">
                {String(sectionCount + 1).padStart(2, '0')} / 交付物
              </span>
              <div className="case-deliverables">
                {project.deliverables.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
          )}
        </article>
        <Link href="/#work" className="article-end-link">
          回到项目 <ArrowUpRight size={17} />
        </Link>
      </div>
    </main>
  );
}
