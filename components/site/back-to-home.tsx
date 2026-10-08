import Link from 'next/link';
import { Home } from 'lucide-react';

/**
 * 回到首页：文章页右下角圆形悬浮按钮，与回到顶部/搜索按钮同一竖排栈。
 * 纯服务端组件（无交互状态，导航交给 Link）。
 */
export function BackToHome() {
  return (
    <Link href="/#top" className="back-to-home" aria-label="回到首页" title="回到首页">
      <Home size={17} aria-hidden="true" />
    </Link>
  );
}
