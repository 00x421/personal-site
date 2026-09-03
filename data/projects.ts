import { buildProject, type Project } from '@/lib/markdown';

const modules = import.meta.glob('/content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** order 升序，未标注 order 的排最后，同级再按年份倒序。 */
export const projects: Project[] = Object.entries(modules)
  .map(([path, raw]) => buildProject(path.split('/').pop()!.replace(/\.md$/, ''), raw))
  .sort((a, b) => a.order - b.order || Number(b.year) - Number(a.year));

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/** 首页项目筛选维度，按项目自身顺序去重。 */
export const projectFilters: string[] = [
  '全部',
  ...Array.from(new Set(projects.map((project) => project.type))),
];
