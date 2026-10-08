import { execSync } from 'node:child_process';

/**
 * 构建元信息：CI 里来自 GitHub Actions 环境变量，本地构建回退 git。
 * 模块加载时解析一次（静态产物渲染期内联成常量）；拿不到时降级为 dev，
 * 刻意不让它炸构建——构建号是展品，不是依赖。
 *
 * 只该被服务端组件引用：没有 'use client'，client bundle 碰不到它。
 */
function resolveBuildInfo(): { id: string; sha: string } {
  try {
    const id = process.env.GITHUB_RUN_NUMBER ?? '';
    const sha = (
      process.env.GITHUB_SHA ??
      execSync('git rev-parse --short HEAD', { encoding: 'utf8' })
    ).slice(0, 7);
    return { id: id || 'dev', sha: sha || 'dev' };
  } catch {
    return { id: 'dev', sha: 'dev' };
  }
}

export const buildInfo = resolveBuildInfo();
