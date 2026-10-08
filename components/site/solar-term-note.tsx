'use client';

import { useEffect, useState } from 'react';
import { currentSolarTerm } from '@/lib/solar-terms';

/**
 * 时令注：今天处在哪个节气，配一句时令话。一天一换，纸墨的时令感。
 * 住在每页底部的备案行右端（桌面端绝对定位、让开右下角悬浮按钮；
 * 窄屏折行为备案行下方的一行居中小字）。
 *
 * 日期在挂载后于客户端计算（页面是静态产物，服务端算出来会是构建那天）；
 * SSR 与首帧渲染 null，不参与水合，无闪烁差异。
 */
export function SolarTermNote() {
  const [term, setTerm] = useState<{ name: string; gloss: string } | null>(null);

  useEffect(() => {
    setTerm(currentSolarTerm(new Date()));
  }, []);

  if (!term) return null;
  return (
    <p className="solar-note" title={`今日${term.name}`}>
      今日{term.name}——{term.gloss}
    </p>
  );
}
