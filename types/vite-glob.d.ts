interface ImportMeta {
  /** Vite 构建期把匹配文件内容内联（配合 query: '?raw'），无需运行时文件系统。 */
  glob(
    pattern: string,
    options?: { eager?: boolean; query?: string; import?: string },
  ): Record<string, string>;
}
