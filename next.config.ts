import type { NextConfig } from 'vinext';

/**
 * React SSR 会把渲染树内的资源提示合并进 HTTP `Link` 响应头（图片等），
 * 首屏外的图片随之被 preload 而触发 Chrome 的 "was preloaded but not used"
 * 警告。置 0 关闭整个 Link 头（字体 preload 仍由 HTML `<link>` 承担）。
 */
const nextConfig: NextConfig = {
  reactMaxHeadersLength: 0,
};

export default nextConfig;
