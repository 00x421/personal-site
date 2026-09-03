'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { READ_COMPLETE_EVENT } from './reading-progress';

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
  /** 阅读彩蛋：文章页 40s 无交互 → 小狗打盹；任意交互唤醒。 */
  const [sleepy, setSleepy] = useState(false);
  const [justWoken, setJustWoken] = useState(false);
  /** 读完全文的小狗庆祝彩蛋。 */
  const [justFinished, setJustFinished] = useState(false);
  const pathname = usePathname();
  const isReading = pathname.startsWith('/articles/') && !pathname.includes('/tag/');
  // 路由切换时在 render 阶段退出睡眠态（官方「渲染期间调整 state」模式，
  // 避免 effect 里同步 setState 触发级联渲染）。
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setSleepy(false);
  }
  // 服务端快照固定为 12 点，水合前渲染与客户端一致；水合后自动切换到本地时钟。
  const hour = useSyncExternalStore(
    subscribeToHour,
    () => new Date().getHours(),
    () => 12,
  );
  const moodPool = moodsForHour(hour);
  const moodId = justFinished
    ? 'happy'
    : sleepy
      ? 'sleeping'
      : (moodPool[moodIndex % moodPool.length] ?? 'idle');
  const state = stateById[moodId] ?? airPupStates[0];

  useEffect(() => {
    if (!isReading) return;
    let timer = window.setTimeout(() => setSleepy(true), 40_000);
    const wake = () => {
      setSleepy(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSleepy(true), 40_000);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    events.forEach((event) => window.addEventListener(event, wake, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, wake));
    };
  }, [isReading, pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMoodIndex((current) => current + 1);
    }, 6200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setOpen(false);
      setJustWoken(false);
      setJustFinished(false);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [open, moodIndex]);

  useEffect(() => {
    const celebrate = () => {
      setSleepy(false);
      setJustFinished(true);
      setOpen(true);
    };
    window.addEventListener(READ_COMPLETE_EVENT, celebrate);
    return () => window.removeEventListener(READ_COMPLETE_EVENT, celebrate);
  }, []);

  function greet() {
    if (sleepy) setJustWoken(true);
    setSleepy(false);
    setJustFinished(false);
    setOpen(true);
    setMoodIndex((current) => current + 1);
  }

  return (
    <button
      type="button"
      className="nav-buddy"
      onClick={greet}
      aria-label={
        sleepy
          ? 'XWSX 空气小狗读着读着睡着了，点一下叫醒它'
          : `和 XWSX 空气小狗打招呼，当前${state.label}`
      }
      aria-expanded={open}
    >
      {/* oxlint-disable-next-line next/no-img-element -- 原创导航吉祥物需保持透明材质，直接使用本地静态资源。 */}
      <img className="nav-buddy-image" key={state.id} src={state.src} alt="" />
      {sleepy && (
        <span className="nav-buddy-z" aria-hidden>
          z
        </span>
      )}
      {open && (
        <output className="nav-buddy-tip">
          {justFinished
            ? '汪！从头读到尾，这篇是你的了。'
            : justWoken
              ? '呜……被戳醒了。读得入迷了吧。'
              : state.message}
        </output>
      )}
    </button>
  );
}
