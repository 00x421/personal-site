'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { RevealScene } from '@/components/site/reveal-scene';
import { shouldDraw } from '@/lib/swarm-gate';

/**
 * 把一段真实内容包成「由光标蜂群画出来」的区块。
 *
 * 它只做三件事：读环境 → 决定这次要不要演 → 演的话把内容交给 RevealScene。
 * 不演的时候直接把 children 渲染出去（服务端 HTML 与原来完全一致，所以关 JS、
 * 搜索引擎、触屏读者拿到的都是同一份内容）。
 *
 * 判定规则见 lib/swarm-gate.ts：减少动效 / 触屏 / 省流量 / 窄屏 一律不演；
 * `?draw=1` 可以绕过触屏与省流量的判断，但绕不过「减少动态效果」。
 *
 * **不做「看过就不再播」的本地记忆**：每次打开都演一遍。这条记忆以前存在过，
 * 后果是站主自己验收时永远看到静态页、以为效果坏了。
 */
export function SwarmSection({ children }: { children: ReactNode }) {
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;

    const ok = shouldDraw({
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      saveData: connection?.saveData === true,
      viewportWidth: window.innerWidth,
      forced: new URLSearchParams(window.location.search).get('draw') === '1',
    });
    if (!ok) return;

    // 这一页有区块要演：让样式表里的「先藏起来、画完再露」规则生效。
    document.documentElement.dataset.rvPlay = '1';

    // 用 rAF 把 setState 挪出 effect 体：同步 setState 会触发级联渲染（lint 规则），
    // 而这一段都在折叠线以下，晚一帧完全看不出来。
    const id = window.requestAnimationFrame(() => setDraw(true));
    return () => {
      window.cancelAnimationFrame(id);
      // 只清我们自己设的标记，别影响 /lab 里那套页内脚本。
      delete document.documentElement.dataset.rvPlay;
    };
  }, []);

  if (!draw) return <>{children}</>;

  return (
    <RevealScene swarm className="swarm-scene">
      {children}
    </RevealScene>
  );
}
