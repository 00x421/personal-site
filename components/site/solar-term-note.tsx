'use client';

import { useSyncExternalStore } from 'react';
import { currentSolarTerm } from '@/lib/solar-terms';

/**
 * 时令注：今天处在哪个节气，配一句时令话。一天一换，纸墨的时令感。
 * 住在首页刊尾「Writing is thinking.」正下方，grid 居中与之对齐；
 * 窄屏上英文句隐藏，只留这一行居中小字。
 *
 * 日期只能在客户端算（页面是静态产物，服务端算出来会是构建那天）。
 * 这里用 useSyncExternalStore 而不是「挂载后 setState」：
 * 服务端快照固定 null，首帧水合与 SSR 输出一致，之后才换成当天节气。
 */

type SolarTerm = { name: string; gloss: string };

/** 快照按「日」缓存：同一天内必须返回同一个对象，否则会无限重渲染。 */
let cachedDay = '';
let cachedTerm: SolarTerm | null = null;

function getTermSnapshot(): SolarTerm | null {
  const day = new Date().toDateString();
  if (day !== cachedDay || cachedTerm === null) {
    cachedDay = day;
    cachedTerm = currentSolarTerm(new Date());
  }
  return cachedTerm;
}

/** 时令一天一换，没有可订阅的变化：空订阅满足契约即可。 */
function subscribe(): () => void {
  return () => {};
}

/** 服务端不渲染时令注（构建那天的节气不是访客看到的节气）。 */
function getServerSnapshot(): SolarTerm | null {
  return null;
}

export function SolarTermNote() {
  const term = useSyncExternalStore<SolarTerm | null>(
    subscribe,
    getTermSnapshot,
    getServerSnapshot,
  );

  if (!term) return null;
  return (
    <p className="solar-note" title={`今日${term.name}`}>
      今日{term.name}——{term.gloss}
    </p>
  );
}
