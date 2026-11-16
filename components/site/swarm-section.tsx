'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { RevealScene } from '@/components/site/reveal-scene';

/**
 * 把一段真实内容包成「由光标蜂群画出来」的区块。
 *
 * 它只做两件事：等页内脚本的裁决 → 演的话把内容交给 RevealScene。
 * 不演的时候直接把 children 渲染出去（服务端 HTML 与原来完全一致，所以关 JS、
 * 搜索引擎、触屏读者拿到的都是同一份内容）。
 *
 * 判定规则见 lib/swarm-gate.ts（减少动效 / 触屏 / 省流量 / 窄屏 不演，
 * `?draw=1` 可绕过后三项，但绕不过「减少动态效果」）。**裁决发生在页内脚本里**，
 * 不是在这里：首屏那句 motto 要在首帧绘制前就藏好，否则读者会看到文字闪一下
 * 再消失、然后被重新打出来。
 *
 * 也不做「看过就不再播」的本地记忆：每次打开都演一遍。这条记忆以前存在过，
 * 后果是站主自己验收时永远看到静态页、以为效果坏了。
 */
export function SwarmSection({ children }: { children: ReactNode }) {
  const [draw, setDraw] = useState(false);

  useEffect(() => {
    /*
     * 只读不写。以前这里自己设置、卸载时删除 data-rv-play，一旦页面上有两个
     * SwarmSection（首屏 motto + 折叠线以下的关于区），先卸载的那个会把另一个的
     * 隐藏规则一起删掉，后者的内容就会在动画中途冒出来。
     */
    if (document.documentElement.dataset.rvPlay !== '1') return;

    // 用 rAF 把 setState 挪出 effect 体：同步 setState 会触发级联渲染（lint 规则）。
    const id = window.requestAnimationFrame(() => setDraw(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!draw) return <>{children}</>;

  return (
    <RevealScene swarm className="swarm-scene">
      {children}
    </RevealScene>
  );
}
