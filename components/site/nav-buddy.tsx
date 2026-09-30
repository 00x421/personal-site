'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { READ_COMPLETE_EVENT } from './reading-progress';
import { BotChat } from './bot-chat';

/**
 * 吉祥物是 GrokBot 小机器人：形象改编自老A玩AI的开源项目（MIT），
 * 署名见 public/open-source-notices.txt；四态贴图由 scripts/capture-grokbot.mjs
 * 从原版矢量数据渲染（npm run mascot 可复现）。
 */
const buddyStates = [
  {
    id: 'idle',
    src: '/grokbot-idle-nav.webp',
    label: '待机',
    message: '你好，今天也一起把想法做清晰。',
  },
  {
    id: 'thinking',
    src: '/grokbot-thinking-nav.webp',
    label: '思考中',
    message: '让我想想，先把问题拆小一点。',
  },
  {
    id: 'happy',
    src: '/grokbot-happy-nav.webp',
    label: '开心',
    message: '收到！这个想法听起来不错。',
  },
  {
    id: 'sleeping',
    src: '/grokbot-sleeping-nav.webp',
    label: '休息',
    message: '短暂充电，灵感也需要留白。',
  },
] as const;

const stateById = Object.fromEntries(buddyStates.map((s) => [s.id, s]));

/**
 * 主动搭话的台词池：与四态台词分开，隔一阵子随机冒一句。
 * 语气沿用站点人设——机器人的克制版热情；不写会过时的事实性内容
 * （比如书架上有几本书），免得内容一动台词就撒谎。
 * 气泡是系统 sans 字体栈，不受 webfont 字形分片约束。
 */
const chatterLines = [
  '电量充足，灵感待命中。',
  '有想法的话，随时点我。',
  '下面的项目区有热闹，可以去逛逛。',
  '文章不长，读完不亏。',
  '刚在后台巡检了一遍：一切正常。',
  'Cmd/Ctrl+K 可以搜全站，很快的。',
] as const;

/** 按一天的时间段挑选小机器人的活动状态池。 */
function moodsForHour(hour: number) {
  if (hour >= 23 || hour < 7) {
    return ['sleeping', 'sleeping', 'sleeping', 'thinking'] as const;
  }
  if (hour < 10) return ['happy', 'idle', 'happy'] as const;
  if (hour < 18) return ['idle', 'thinking', 'idle', 'thinking'] as const;
  return ['idle', 'thinking', 'happy', 'sleeping'] as const;
}

/** 每小时提醒订阅者刷新，让小机器人随时间切换状态池。 */
function subscribeToHour(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

/** 导航吉祥物：跟随真实时钟切换姿势，点击打招呼并弹出气泡。 */
export function NavBuddy() {
  const [open, setOpen] = useState(false);
  const [moodIndex, setMoodIndex] = useState(0);
  /** 阅读彩蛋：文章页 40s 无交互 → 小机器人休眠；任意交互唤醒。 */
  const [sleepy, setSleepy] = useState(false);
  const [justWoken, setJustWoken] = useState(false);
  /** 读完全文的庆祝彩蛋。 */
  const [justFinished, setJustFinished] = useState(false);
  /** 主动搭话：非空的这段时间里，气泡显示的是台词池内容而非状态台词。 */
  const [chatter, setChatter] = useState<string | null>(null);
  /** 「问小机器人」面板与入口开关。开关懒查询：第一次点它才问服务端。 */
  const [chatOpen, setChatOpen] = useState(false);
  const [askEnabled, setAskEnabled] = useState<boolean | null>(null);
  const askStatusRef = useRef<Promise<boolean> | null>(null);

  function ensureAskStatus(): Promise<boolean> {
    askStatusRef.current ??= fetch('/api/ask')
      .then((res) => res.json() as Promise<{ enabled: boolean }>)
      .then((data) => {
        setAskEnabled(data.enabled);
        return data.enabled;
      })
      .catch(() => {
        askStatusRef.current = null;
        return false;
      });
    return askStatusRef.current;
  }

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
  const state = stateById[moodId] ?? buddyStates[0];
  // 主动搭话的定时器只在挂载时排一次，触发瞬间的最新状态经 ref 读取，
  // 避免 moodIndex 每 6.2s 一变就把定时器重排、永远等不到开口的那天。
  const chatterGate = useRef({ open, sleepy, justFinished, moodId });
  useEffect(() => {
    chatterGate.current = { open, sleepy, justFinished, moodId };
  });

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
      setChatter(null);
      setJustWoken(false);
      setJustFinished(false);
    }, 3600);
    return () => window.clearTimeout(timer);
  }, [open, moodIndex]);

  // 主动搭话：22–48s 随机间隔冒一句。触发瞬间若气泡已开、休眠或正在庆祝、
  // 当前姿势是睡觉图，就保持沉默（但照常排下一次）。
  // 不做 document.visibilityState 判断：内嵌 webview 可能常报 hidden
  // （实测如此），而后台标签页的定时器节流本身就会让搭话自然停摆。
  useEffect(() => {
    let lastPick = -1;
    let timer: number;
    function schedule() {
      timer = window.setTimeout(() => {
        const gate = chatterGate.current;
        if (!gate.open && !gate.sleepy && !gate.justFinished && gate.moodId !== 'sleeping') {
          let pick = Math.floor(Math.random() * chatterLines.length);
          if (pick === lastPick) pick = (pick + 1) % chatterLines.length;
          lastPick = pick;
          setChatter(chatterLines[pick]);
          setOpen(true);
        }
        schedule();
      }, 22_000 + Math.random() * 26_000);
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

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
    // 气泡已开时的第二次点击 = 打开提问面板（开关已关则退回普通打招呼）
    if (open) {
      setSleepy(false);
      setJustFinished(false);
      if (askEnabled === true) {
        setOpen(false);
        setChatter(null);
        setChatOpen(true);
        return;
      }
      if (askEnabled === null) {
        void ensureAskStatus().then((enabled) => {
          if (enabled) {
            setOpen(false);
            setChatter(null);
            setChatOpen(true);
          }
        });
        return;
      }
    }
    if (sleepy) setJustWoken(true);
    setSleepy(false);
    setJustFinished(false);
    // 访客点了它：接管气泡，主动搭话让位
    setChatter(null);
    setOpen(true);
    setMoodIndex((current) => current + 1);
    void ensureAskStatus();
  }

  return (
    <>
      <button
        type="button"
        className="nav-buddy"
        onClick={greet}
        aria-label={
          sleepy
            ? '小信读着读着休眠了，点一下唤醒'
            : open && askEnabled
              ? '小信正在说话，再点一次打开提问'
              : `和小信打招呼，当前${state.label}`
        }
        aria-expanded={open}
      >
        {/* oxlint-disable-next-line next/no-img-element -- 吉祥物贴图需保持透明底，直接使用本地静态资源。 */}
        <img
          className="nav-buddy-image"
          key={state.id}
          src={state.src}
          alt=""
          /* 这是首屏的 LCP 元素（Lighthouse 桌面端实测由它决定 LCP）。
             它只有 ~7 KB，但如果不标明优先级，就会和 155 KB 的肖像图等资源
             平起平坐地抢带宽。 */
          fetchPriority="high"
        />
        {sleepy && (
          <span className="nav-buddy-z" aria-hidden>
            z
          </span>
        )}
        {open && (
          <output
            className="nav-buddy-tip"
            aria-hidden={chatter !== null ? true : undefined}
          >
            {justFinished
              ? '自检完成：从头读到尾，这篇是你的了。'
              : justWoken
                ? '重启完成。读得入迷了吧。'
                : (chatter ?? state.message)}
            {askEnabled !== false && !justFinished && !justWoken && (
              <span className="nav-buddy-hint">再点一下，向小信提问</span>
            )}
          </output>
        )}
      </button>
      {/* 对话面板不能放进 button 里：<dialog> 是交互元素，button 嵌交互元素
          不合法，且 button 的 text-align:center 会被 dialog 继承（实测答案
          全部居中）。放外面做兄弟节点，定位用 fixed 不受影响。 */}
      <BotChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
