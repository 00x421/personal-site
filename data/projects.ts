import { buildProject, type Project } from '@/lib/markdown';

const modules = import.meta.glob('/content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** order 升序，未标注 order 的排最后，同级再按年份倒序。draft 的项目整体不出现。 */
export const projects: Project[] = Object.entries(modules)
  .map(([path, raw]) => buildProject(path.split('/').pop()!.replace(/\.md$/, ''), raw))
  .filter((project) => !project.draft)
  .sort((a, b) => a.order - b.order || Number(b.year) - Number(a.year));

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

/** 首页项目筛选维度，按项目自身顺序去重。 */
export const projectFilters: string[] = [
  '全部',
  ...Array.from(new Set(projects.map((project) => project.type))),
];

/**
 * 只含卡片字段的投影，供首页那个客户端组件使用。
 *
 * **不要**让客户端组件直接 import 上面那个 `projects`：本模块用 eager 的
 * `import.meta.glob('?raw')` 把全部 Markdown 原文内联进来，客户端一旦引用
 * 就会连带打进 marked、prismjs 与所有案例全文（实测 84 KB 解压）。
 * 这里返回的每个对象都只有十来个短字符串，序列化成本可忽略。
 */
export const projectCards = projects.map((project) => ({
  slug: project.slug,
  title: project.title,
  type: project.type,
  year: project.year,
  summary: project.summary,
  tags: project.tags,
  tone: project.tone,
  mark: project.mark,
  status: project.status,
  hasCase: project.hasCase,
}));
