'use client';

import { useEffect, useState } from 'react';

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

/** 导航吉祥物：定时切换姿势，点击打招呼并弹出气泡。 */
export function NavBuddy() {
  const [open, setOpen] = useState(false);
  const [stateIndex, setStateIndex] = useState(0);
  const state = airPupStates[stateIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStateIndex((current) => (current + 1) % airPupStates.length);
    }, 6200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), 3600);
    return () => window.clearTimeout(timer);
  }, [open, stateIndex]);

  function greet() {
    setOpen(true);
    setStateIndex((current) => (current + 1) % airPupStates.length);
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
