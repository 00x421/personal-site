'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { RevealScene } from '@/components/site/reveal-scene';
import { SWARM_SEEN_KEY, shouldDraw } from '@/lib/swarm-gate';

/**
 * 把一段真实内容包成「由光标蜂群画出来」的区块。
 *
 * 它只做三件事：读环境 → 决定这次要不要演 → 演的话把内容交给 RevealScene。
 * 不演的时候直接把 children 渲染出去（服务端 HTML 与原来完全一致，所以关 JS、
 * 搜索引擎、老访客拿到的都是同一份内容）。
 *
 * 判定规则见 lib/swarm-gate.ts：减少动效 / 触屏 / 省流量 / 已看过 / 窄屏 一律不演；
 * `?draw=1` 可以要求重看（但绕不过「减少动态效果」）。
 */
export function SwarmSection({ children }: { children: ReactNode }) {
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    let seenBefore = false;
    try {
      seenBefore = window.localStorage.getItem(SWARM_SEEN_KEY) === '1';
    } catch {
      // 隐私模式下 localStorage 会抛：当作「没看过」，但也不写回。
    }

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;

    const ok = shouldDraw({
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
        .matches,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      saveData: connection?.saveData === true,
      seenBefore,
      viewportWidth: window.innerWidth,
      forced: new URLSearchParams(window.location.search).get('draw') === '1',
    });
    if (!ok) return;

    // 这一页有区块要演：让样式表里的「先藏起来、画完再露」规则生效。
    document.documentElement.dataset.rvPlay = '1';
    try {
      window.localStorage.setItem(SWARM_SEEN_KEY, '1');
    } catch {
      // 写不进去就算了：下次还会演一遍，不算错误。
    }

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
