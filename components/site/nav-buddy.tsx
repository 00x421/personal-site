'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const airPupStates = [
  {
    id: 'idle',
    src: '/xwsx-air-pup-nav.png',
    label: '待机',
    message: '你好，今天也一起把想法做清晰。',
  },
  {
    id: 'thinking',
    src: '/xwsx-air-pup-thinking-nav.png',
    label: '思考中',
    message: '让我想想，先把问题拆小一点。',
  },
  {
    id: 'happy',
    src: '/xwsx-air-pup-happy-nav.png',
    label: '开心',
    message: '汪！这个想法听起来不错。',
  },
  {
    id: 'sleeping',
    src: '/xwsx-air-pup-sleeping-nav.png',
    label: '休息',
    message: '短暂充电，灵感也需要留白。',
  },
] as const;

const stateById = Object.fromEntries(airPupStates.map((s) => [s.id, s]));

/** 按一天的时间段挑选小狗的活动状态池。 */
function moodsForHour(hour: number) {
  if (hour >= 23 || hour < 7) {
    return ['sleeping', 'sleeping', 'sleeping', 'thinking'] as const;
  }
  if (hour < 10) return ['happy', 'idle', 'happy'] as const;
  if (hour < 18) return ['idle', 'thinking', 'idle', 'thinking'] as const;
  return ['idle', 'thinking', 'happy', 'sleeping'] as const;
}

/** 每小时提醒订阅者刷新，让小狗随时间切换状态池。 */
function subscribeToHour(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

/** 导航吉祥物：跟随真实时钟切换姿势，点击打招呼并弹出气泡。 */
export function NavBuddy() {
  const [open, setOpen] = useState(false);
  const [moodIndex, setMoodIndex] = useState(0);
  // 服务端快照固定为 12 点，水合前渲染与客户端一致；水合后自动切换到本地时钟。
  const hour = useSyncExternalStore(
    subscribeToHour,
    () => new Date().getHours(),
    () => 12,
  );
  const moodPool = moodsForHour(hour);
  const moodId = moodPool[moodIndex % moodPool.length] ?? 'idle';
  const state = stateById[moodId] ?? airPupStates[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMoodIndex((current) => current + 1);
    }, 6200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), 3600);
    return () => window.clearTimeout(timer);
  }, [open, moodIndex]);

  function greet() {
    setOpen(true);
    setMoodIndex((current) => current + 1);
  }

  return (
    <button
      type="button"
      className="nav-buddy"
      onClick={greet}
      aria-label={`和 XWSX 空气小狗打招呼，当前${state.label}`}
      aria-expanded={open}
    >
      {/* oxlint-disable-next-line next/no-img-element -- 原创导航吉祥物需保持透明材质，直接使用本地静态资源。 */}
      <img className="nav-buddy-image" key={state.id} src={state.src} alt="" />
      {open && <output className="nav-buddy-tip">{state.message}</output>}
    </button>
  );
}
