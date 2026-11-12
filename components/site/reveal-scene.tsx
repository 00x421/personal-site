'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  bowedPoint,
  clamp,
  countUpAt,
  detourPoint,
  dwellMs,
  easeGrow,
  edgePoint,
  frameSizeAt,
  handCountFor,
  handTravelMs,
  measureDurationMs,
  textOffsetAt,
  typingSchedule,
} from '@/lib/reveal-motion';
import type { TypingStep } from '@/lib/reveal-motion';

/**
 * 「多光标把内容写出来」的这一层。
 *
 * 结构是按 winc.si 真实实现搭的（反编译结果见本次调查记录），三段：
 *
 *   1. **调度器**：一张事件表（时间点 → 回调）+ 一张驱动表（区间 → 逐帧回调），
 *      共用一条 rAF。不用 CSS transition 排队，因为手和文字必须共享同一条时钟。
 *   2. **手（Hand）**：每支手有一条 act 队列，act 是「从哪到哪、用什么笔、按没按下、
 *      走什么弧线」。手的位置每帧从队列里插值出来；箭头笔形会朝行进方向转。
 *   3. **内容**：文字用 CSS Custom Highlight 逐字揭示（DOM 不动，绝不重排），
 *      框用 driver 逐帧量元素真实矩形，数字逐帧滚，图表由笔沿路径扫。
 *
 * 三条不照搬的地方：
 * - 隐藏态只挂在 `html[data-rv-play='1']` 下（页内脚本首屏前加），
 *   所以无 JS / 减少动效 / 抓取程序拿到的是完整可读内容；
 * - 不支持 `CSS.highlights` 的浏览器不做逐字，直接整块出现（宁可少效果，不要白屏）；
 * - 颜色走站点 token，不引入 Figma 蓝。
 */

type Tool = 'arrow' | 'cross' | 'ibeam' | 'resize' | 'pen';
type Point = { x: number; y: number };

/** 光标名字只放拉丁名：中文名会牵动 31 个字体分片，为一个装饰层不划算。 */
const NAMES = [
  'Ada',
  'Leo',
  'Mia',
  'Kai',
  'Zoe',
  'Max',
  'Ivy',
  'Sam',
  'Noa',
  'Eli',
  'Rui',
  'Tess',
  'Jun',
  'Oli',
];

/**
 * 11 色印刷色板：与参考站同一组色名，色值在 globals.css 的 --sw-* 里明暗成对给出。
 * 每支手随机分到一个，整群看起来才像「很多人各握一支彩色笔」，而不是单色演示。
 */
const HAND_COLORS = [
  'blue',
  'red',
  'green',
  'ochre',
  'violet',
  'pink',
  'rust',
  'pine',
  'deep',
  'olive',
  'maroon',
];

/** 笔形。填充型走 body，线型走 rim（纸色）叠 ink（彩色）。 */
const GLYPHS: Record<Tool, string> = {
  arrow: '<path class="rv-body" d="M2 2L14 6.7L8.7 8.7L6.7 14Z"/>',
  pen: '<path class="rv-body" d="M2 14L3.3 10L10.6 2.7L13.3 5.4L6 12.7Z"/>',
  cross:
    '<path class="rv-rim" d="M8 2.5V13.5M2.5 8H13.5"/><circle class="rv-rim" cx="8" cy="8" r="2.8"/><path class="rv-ink" d="M8 2.5V13.5M2.5 8H13.5"/><circle class="rv-ink" cx="8" cy="8" r="2.8"/>',
  ibeam:
    '<path class="rv-rim" d="M6 2.5H10M6 13.5H10M8 2.5V13.5"/><path class="rv-ink" d="M6 2.5H10M6 13.5H10M8 2.5V13.5"/>',
  resize:
    '<path class="rv-rim" d="M4 4L12 12M4 4V7.5M4 4H7.5M12 12V8.5M12 12H8.5"/><path class="rv-ink" d="M4 4L12 12M4 4V7.5M4 4H7.5M12 12V8.5M12 12H8.5"/>',
};

/** 每种笔形的热点：光标尖端/中心在哪，位置与旋转都以它为基准。 */
const HOTSPOT: Record<Tool, Point> = {
  arrow: { x: 2, y: 2 },
  cross: { x: 8, y: 8 },
  ibeam: { x: 8, y: 8 },
  resize: { x: 8, y: 8 },
  pen: { x: 2, y: 14 },
};

/** 上限朝向左上（-135°），箭头初始指向左上，和真实光标的习惯一致。 */
const BASE_HEADING = Math.atan2(-1, -1);
/** 全局快慢：越小越慢。上游取 0.52。 */
const SPEED = 0.52;
/** 光标空闲多久后离场。 */
const HAND_IDLE_MS = 2400;
/** 滚动之后多少毫秒内光标会离场（用户一动滚轮，手就散开）。 */
const SCROLL_ESCAPE_MS = 250;
/** 数字滚到真值的时间。 */
const COUNT_MS = 1400;
/** 标题从多小长到 1。 */
const HEADLINE_SCALE = 0.46;
/** 高亮区的名字：`::highlight(rv-untyped)` 在样式表里与之对应。 */
const HIGHLIGHT_NAME = 'rv-untyped';

/** 光标单帧最大位移（px）。约 90px/帧 ≈ 5400px/s，正常移动都在这之下。 */
const MAX_STEP_PER_FRAME = 90;

/** 一节进入视口后等多久才开演：轻微掠过不触发（对齐上游的 160ms）。 */
const SECTION_DEBOUNCE_MS = 160;

/** 两节之间留给读者喘气的时间：上一节画完到下一节开演的间隔。 */
const SECTION_GAP_MS = 240;

type Target =
  | { at: Point }
  | { get: () => Point }
  | { el: HTMLElement; fx: number; fy: number; dx?: number; dy?: number };

type Act = {
  t0: number;
  t1: number;
  from: Target;
  to: Target;
  tool: Tool;
  down?: boolean;
  bow?: number;
  ease?: (t: number) => number;
  aim?: boolean;
  path?: (progress: number, now: number) => Point;
  /**
   * 每帧最大位移（px）。设置后不会直接跳到 `path` 的返回值，而是朝它走、
   * 一步最多走这么远。
   *
   * 写字时笔尖跟着字符走，而**换行**是 600px 的横向位移——直接跟就是瞬移。
   * 限速之后换行变成约 180ms 的快速滑动，像把笔提过去，而不是闪现。
   */
  follow?: number;
};

type Driver = {
  t0: number;
  t1: number;
  fn: (progress: number, now: number) => void;
};
type EventJob = { t: number; fn: () => void };
/** 一次播放的「作业」：取消它就能把这一节自己造出来的东西全部收回去。 */
type Job = {
  events: Set<EventJob>;
  drivers: Set<Driver>;
  hands: Set<Hand>;
  /** 本次作业画出来的选框 / 错字 / 高亮区间 / 已揭示元素，取消时统一回收。 */
  frames: Set<HTMLElement>;
  slips: Set<HTMLElement>;
  ranges: Set<Range>;
  revealed: Set<HTMLElement>;
};

/** 解析目标坐标（视口坐标系）。 */
function resolveTarget(target: Target): Point {
  if ('at' in target) return target.at;
  if ('get' in target) return target.get();
  const rect = target.el.getBoundingClientRect();
  return {
    x: rect.left + rect.width * target.fx + (target.dx ?? 0),
    y: rect.top + rect.height * target.fy + (target.dy ?? 0),
  };
}

/** 把点偏移一下。 */
function shift(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy };
}

/**
 * 朝目标走一步，单步不超过 `maxStep`（px/帧）。
 *
 * 用来跟着一个会「跳」的目标走（写字换行、文字重排）：直接赋值就是瞬移，
 * 限速之后是一段短促的滑动。没给 `maxStep` 就直达到位。
 */
function limitedStep(from: Point, to: Point, maxStep?: number): Point {
  if (!maxStep || maxStep <= 0) return to;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxStep) return to;
  const ratio = maxStep / distance;
  return { x: from.x + dx * ratio, y: from.y + dy * ratio };
}

class Hand {
  el: HTMLElement;
  icon: HTMLElement;
  acts: Act[] = [];
  pos: Point;
  at: Target;
  free: number;
  name: string;
  color: string;
  tool: Tool | null = null;
  down = false;
  aim = false;
  heading = BASE_HEADING;
  /** 下一次「闲逛」的时间戳（空闲时才会用到）。 */
  nextWander?: number;

  constructor(layer: HTMLElement, index: number, start: Point, freeAt: number) {
    // 11 色印刷色板：与参考站一致，靠 k-<color> 类给每支手一个 --hand。
    this.color = HAND_COLORS[index % HAND_COLORS.length];
    this.name = NAMES[index % NAMES.length];
    this.el = document.createElement('i');
    this.el.className = `rv-hand k-${this.color}`;
    this.el.setAttribute('aria-hidden', 'true');
    this.icon = document.createElement('span');
    this.icon.className = 'rv-icon';
    const tag = document.createElement('span');
    tag.className = 'rv-tag';
    tag.textContent = this.name;
    // 名字牌随机歪一点：手贴上去的，不是印刷的
    tag.style.rotate = `${(Math.random() - 0.5) * 9}deg`;
    this.el.appendChild(this.icon);
    this.el.appendChild(tag);
    layer.appendChild(this.el);
    this.pos = start;
    this.at = { at: start };
    this.free = freeAt;
    this.setTool('arrow');
    this.place(start);
  }

  setTool(tool: Tool): void {
    if (tool === this.tool) return;
    this.tool = tool;
    this.icon.innerHTML = `<svg viewBox="0 0 16 16">${GLYPHS[tool]}</svg>`;
    this.el.dataset.tool = tool;
    const hot = HOTSPOT[tool];
    this.icon.style.transformOrigin = `${hot.x}px ${hot.y}px`;
  }

  place(point: Point, maxStep = MAX_STEP_PER_FRAME): void {
    const tool = this.tool ?? 'arrow';
    // 兜底：单帧位移设上限。真实光标不会瞬移——任何「目标突然变了」的路径
    // （换行、元素重排、任务切换）都由这一道挡住，最坏情况是快速滑动而不是闪现。
    const next = limitedStep(this.pos, point, maxStep);
    const dx = next.x - this.pos.x;
    const dy = next.y - this.pos.y;
    if (!this.aim) {
      this.heading = BASE_HEADING;
    } else if (Math.hypot(dx, dy) > 0.8) {
      const want = Math.atan2(dy, dx);
      // 走最短弧，且只转 1/4：手的转向永远滞后于移动
      this.heading +=
        Math.atan2(
          Math.sin(want - this.heading),
          Math.cos(want - this.heading),
        ) * 0.25;
    }
    this.pos = next;
    const hot = HOTSPOT[tool];
    const rotate = tool === 'arrow' ? this.heading - BASE_HEADING : 0;
    this.el.style.transform = `translate(${next.x - hot.x}px, ${next.y - hot.y}px)`;
    this.icon.style.rotate = rotate ? `${rotate}rad` : '';
  }

  setDown(down: boolean): void {
    if (down === this.down) return;
    this.down = down;
    this.el.classList.toggle('is-down', down);
  }

  update(now: number): void {
    while (this.acts.length > 1 && this.acts[0].t1 < now) this.acts.shift();

    // 只认「已经开始且还没结束」的那一段。以前这里用 `find(a => now < a.t1) ?? at(-1)`，
    // 在两段之间的空档会取到还没开始的那一段、进度夹成 0，手就瞬移过去了。
    const active = this.acts.find((a) => now >= a.t0 && now < a.t1);

    if (!active) {
      // 空档：停在上一段的落点。落点是活的（el / get）就继续跟着走，绝不跳。
      // 倒序找最后一段已结束的：不分配数组，避免每帧给 GC 添垃圾（卡顿的来源之一）。
      let done: Act | undefined;
      for (let i = this.acts.length - 1; i >= 0; i -= 1) {
        if (this.acts[i].t1 <= now) {
          done = this.acts[i];
          break;
        }
      }
      if (!done) return;
      this.setDown(false);
      this.aim = false;
      const end = done.path?.(1, now) ?? resolveTarget(done.to);
      this.place(limitedStep(this.pos, end, done.follow));
      return;
    }

    this.setTool(active.tool);
    this.setDown(Boolean(active.down) && now >= active.t0 && now < active.t1);
    this.aim = Boolean(active.aim) && now >= active.t0 && now < active.t1;

    const progress = clamp(
      (now - active.t0) / Math.max(active.t1 - active.t0, 1),
      0,
      1,
    );
    const custom = active.path?.(progress, now);
    if (custom) {
      this.place(limitedStep(this.pos, custom, active.follow));
      return;
    }
    const from = resolveTarget(active.from);
    const to = resolveTarget(active.to);
    const eased = active.ease ? active.ease(progress) : easeGrow(progress);
    this.place(bowedPoint(from, to, eased, active.bow ?? 0));
  }
}

type SceneItem = {
  el: HTMLElement;
  kind: string;
  /** 文字类内容：按码点拆开的字符（CJK 会补一个占位让它多占一拍）。 */
  chars: string[];
  /** 每个文本节点，用于把字符序号映射成 DOM 偏移。 */
  nodes: Text[];
  range: Range | null;
  shown: number;
};

type RevealSceneProps = {
  children: ReactNode;
  className?: string;
  replayable?: boolean;
  /** 蜂群模式：一群光标抢活并行把内容画出来，画完集体散场（实验页用）。 */
  swarm?: boolean;
};

export function RevealScene({
  children,
  className = '',
  replayable = false,
  swarm = false,
}: RevealSceneProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [take, setTake] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-rv]'));
    // 没有任何 data-rv 标记不代表空场景：自动收集的文本叶子也算内容。
    // （首页 #about 就没有任何标记，全靠自动收集。）
    const hasAutoText = (root.textContent ?? '').trim().length > 0;
    if (targets.length === 0 && !hasAutoText) return;

    const supportsHighlight =
      'highlights' in CSS && typeof Highlight === 'function';
    const rng = Math.random;

    /* ---------------- 层 ---------------- */
    /*
     * 每节一层，层就长在节里面（`inset:0` 铺满节的 padding box）。
     *
     * 这是参考站的做法，也是唯一没有副作用的做法：框的坐标只在「这一节的坐标系」
     * 里算，之后卷动、重排、字体回填，框都跟着层一起走，永远不需要再同步一次。
     * 之前那版把框画在场景根节点上、再靠一个每帧跑的同步器搬位置，等于两条路同时
     * 在写同一个元素的 left/top：动画被覆盖、框被误判成「漂移」提前收掉，都是它。
     */
    const layers = new Map<HTMLElement, HTMLElement>();
    const layerFor = (host: HTMLElement) => {
      let layer = layers.get(host);
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'rv-layer';
        host.classList.add('rv-layer-host');
        host.appendChild(layer);
        layers.set(host, layer);
      }
      return layer;
    };
    /** 框（和错字）属于哪一节；没有登记过就退回场景根。 */
    const owners = new WeakMap<HTMLElement, HTMLElement>();
    /** 框所在层的矩形 = 这一节坐标系的零点。 */
    const baseOf = (el: HTMLElement) =>
      layerFor(owners.get(el) ?? root).getBoundingClientRect();
    const handLayer = document.createElement('div');
    handLayer.className = 'rv-hands';
    root.appendChild(handLayer);

    /* ---------------- 调度器 ---------------- */
    const events: EventJob[] = [];
    const drivers: Driver[] = [];
    const hands: Hand[] = [];
    let job: Job | null = null;
    let rafId = 0;
    let stopped = false;
    let lastScrollAt = -Infinity;
    const idleSince = new Map<Hand, number>();

    /*
     * 滚动只记一个时间戳，用来让空闲的手散场。
     *
     * 框在滚动时什么都不用做：它就长在节自己的坐标系里，节往哪走框往哪走。
     * （旧实现靠一个每帧同步器把框「搬」过去，滚动快了就慢半拍，看上去就是错位。）
     */
    const onScroll = () => {
      lastScrollAt = performance.now();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const at = (time: number, fn: () => void) => {
      const entry = { t: time, fn };
      events.push(entry);
      job?.events.add(entry);
    };
    const during = (
      t0: number,
      t1: number,
      fn: (progress: number, now: number) => void,
    ) => {
      const entry = { t0, t1, fn };
      drivers.push(entry);
      job?.drivers.add(entry);
    };

    /** 元素属于哪一节：框、错字、作业认领都用它。 */
    const sectionOf = (el: HTMLElement) =>
      el.closest<HTMLElement>('[data-rv-section]') ?? root;

    /** 记一次「这条内容已经出现」，取消作业时要能撤回。 */
    const markDone = (el: HTMLElement) => {
      el.setAttribute('data-rv-done', '');
      // 回调是稍后才跑的，那时 job 指针已经交还给别的节了，
      // 所以按元素所属的节去认领自己的作业。
      (sections.get(sectionOf(el)) ?? sections.get(root))?.job?.revealed.add(el);
    };

    const kick = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(tick);
    };

    /** 空闲的手：小幅游走、久了就离场、用户一滚就散。 */
    const idle = (now: number) => {
      for (let i = hands.length - 1; i >= 0; i -= 1) {
        const hand = hands[i];
        const busyUntil = Math.max(hand.free, hand.acts.at(-1)?.t1 ?? 0);
        if (busyUntil > now) continue;
        const since = idleSince.get(hand);
        if (since === undefined) {
          idleSince.set(hand, now);
          continue;
        }
        const offscreen =
          hand.pos.x < -20 ||
          hand.pos.y < -20 ||
          hand.pos.x > innerWidth + 20 ||
          hand.pos.y > innerHeight + 20;
        const scrolled = now - lastScrollAt < SCROLL_ESCAPE_MS;
        // 蜂群模式画完就走（600ms）：这个效果的意思就是「画完它就自己消失」。
        if (
          now - since > (swarm ? 600 : HAND_IDLE_MS) ||
          offscreen ||
          scrolled
        ) {
          leave(hand, now);
          idleSince.delete(hand);
          hands.splice(i, 1);
          continue;
        }
        // 每 1.2–2.6s 有 20% 几率挪一小步：手不会钉死在原地
        const nextAt = hand.nextWander ?? since + 600 + rng() * 900;
        hand.nextWander = nextAt;
        if (now < nextAt) continue;
        hand.nextWander = now + 1200 + rng() * 1400;
        if (rng() > 0.2) continue;
        const angle = rng() * Math.PI * 2;
        const radius = 18 + rng() * 42;
        hand.at = { at: hand.pos };
        const end = now + 700 + rng() * 400;
        hand.acts.push({
          t0: now,
          t1: end,
          from: { at: hand.pos },
          to: {
            at: {
              x: hand.pos.x + Math.cos(angle) * radius,
              y: hand.pos.y + Math.sin(angle) * radius,
            },
          },
          tool: 'arrow',
          bow: 0.12,
        });
        hand.at = hand.acts.at(-1)!.to;
        hand.free = end;
      }
    };

    /** 离场：朝最近的视口边走出去，然后移除。 */
    const leave = (hand: Hand, now: number) => {
      const exit = edgePoint(hand.pos, {
        width: innerWidth,
        height: innerHeight,
      });
      const distance = Math.hypot(exit.x - hand.pos.x, exit.y - hand.pos.y);
      const end = now + handTravelMs(distance, 40, SPEED) * 1.1;
      hand.acts = [
        {
          t0: now,
          t1: end,
          from: { at: hand.pos },
          to: { at: exit },
          tool: 'arrow',
          bow: 0.06 * (rng() < 0.5 ? -1 : 1),
        },
      ];
      at(end + 50, () => hand.el.remove());
    };

    const tick = (now: number) => {
      if (stopped) return;
      for (let i = events.length - 1; i >= 0; i -= 1) {
        if (events[i].t > now) continue;
        const entry = events.splice(i, 1)[0];
        job?.events.delete(entry);
        entry.fn();
      }
      for (let i = drivers.length - 1; i >= 0; i -= 1) {
        const entry = drivers[i];
        if (now < entry.t0) continue;
        const progress = Math.min(
          (now - entry.t0) / Math.max(entry.t1 - entry.t0, 1),
          1,
        );
        entry.fn(progress, now);
        if (progress >= 1) {
          drivers.splice(i, 1);
          job?.drivers.delete(entry);
        }
      }
      for (const hand of hands) hand.update(now);
      idle(now);
      rafId =
        events.length > 0 || drivers.length > 0 || hands.length > 0
          ? window.requestAnimationFrame(tick)
          : 0;
    };

    /* ---------------- 手的管理 ---------------- */
    // 蜂群模式要的是「同时有很多支在画」：数量按面积给、上限更高；
    // 单人模式沿用原来的面积公式（桌面约 12 支，但那 12 支是池子，不是同时登场）。
    const maxHands = () =>
      swarm
        ? Math.min(
            14,
            Math.max(8, Math.round((innerWidth * innerHeight) / 42000)),
          )
        : handCountFor(innerWidth * innerHeight);

    const claim = (
      target: Target,
      earliest: number,
      exclude: Hand[] = [],
    ): Hand | null => {
      const now = performance.now();
      const wanted = resolveTarget(target);
      let best: Hand | null = null;
      let bestAt = Infinity;
      for (const hand of hands) {
        if (exclude.includes(hand)) continue;
        const here = resolveTarget(hand.at);
        const ready = Math.max(
          Math.max(hand.free, now) +
            handTravelMs(
              Math.hypot(wanted.x - here.x, wanted.y - here.y),
              24,
              SPEED,
            ),
          earliest,
        );
        if (ready < bestAt) {
          best = hand;
          bestAt = ready;
        }
      }
      // 手不够就再派一支（从最近的边进来）；已经够多就复用最闲的。
      // 蜂群模式：只要没到上限就新建——「一群光标同时干活」正是这个效果本身。
      // 单人模式：只有新开一支能早到 120ms 以上才建，否则从屏幕外飞进来反而更吵。
      const entryReady = bestAt;
      if (hands.length < maxHands()) {
        const entry = edgePoint(wanted, {
          width: innerWidth,
          height: innerHeight,
        });
        const arrive =
          now +
          handTravelMs(
            Math.hypot(wanted.x - entry.x, wanted.y - entry.y),
            24,
            SPEED,
          );
        if (!best || swarm || arrive + 120 < entryReady) {
          const created = new Hand(handLayer, hands.length, entry, now);
          created.at = { at: entry };
          hands.push(created);
          idleSince.delete(created);
          return created;
        }
      }
      return best;
    };

    /**
     * 移动到目标：先「冲过头」再纠正（两段，转弯），全程走弧线。
     * 返回抵达时刻。这是「像手」而不是「像补间」的关键一步。
     */
    const moveTo = (
      hand: Hand,
      target: Target,
      earliest: number,
      reference: number,
      tool: Tool,
    ): number => {
      const now = performance.now();
      const from = resolveTarget(hand.at);
      const to = resolveTarget(target);
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const start = Math.max(
        hand.free,
        now,
        earliest - handTravelMs(distance, reference, SPEED) * 1.2,
      );
      const bow = (rng() < 0.5 ? -1 : 1) * (0.03 + rng() * 0.05);
      const end = start + handTravelMs(distance, reference, SPEED);
      const drift = detourPoint(from, to, rng);

      hand.acts.push({
        t0: start,
        t1: end,
        from: hand.at,
        to: drift ? { at: drift } : target,
        tool: 'arrow',
        bow,
      });
      if (!drift) {
        hand.at = target;
        hand.free = end;
        return end;
      }
      const rest = Math.hypot(to.x - drift.x, to.y - drift.y);
      const settle = end + handTravelMs(rest, reference, SPEED) * 0.8;
      hand.acts.push({
        t0: end,
        t1: settle,
        from: { at: drift },
        to: target,
        tool,
        bow: bow * 0.3,
      });
      hand.at = target;
      hand.free = settle;
      return settle;
    };

    /** 原地按住一段时间。 */
    const hold = (
      hand: Hand,
      t0: number,
      t1: number,
      tool: Tool,
      down = false,
    ) => {
      hand.acts.push({ t0, t1, from: hand.at, to: hand.at, tool, down });
      hand.free = Math.max(hand.free, t1);
    };

    /** 沿一个会实时变的目标滑过去（文字在长高时用它）。 */
    const glide = (
      hand: Hand,
      target: Target,
      t0: number,
      t1: number,
      tool: Tool,
      down = false,
    ) => {
      hand.acts.push({ t0, t1, from: hand.at, to: target, tool, down, bow: 0 });
      hand.at = target;
      hand.free = Math.max(hand.free, t1);
    };

    /* ---------------- 选框 ---------------- */
    /*
     * 框的定位只有一条路：谁驱动它，谁就在驱动里写 left/top/width/height。
     * 没有第二个人碰它，就不会再出现「框提前画好、钉在原处」。
     */
    const makeFrame = (host: HTMLElement, variant = '') => {
      const box = document.createElement('div');
      box.className = `rv-frame ${variant}`.trim();
      const badge = document.createElement('span');
      badge.className = 'rv-badge';
      for (const corner of ['tl', 'tr', 'bl', 'br']) {
        const handle = document.createElement('i');
        handle.className = corner;
        box.appendChild(handle);
      }
      box.appendChild(badge);
      // 先藏起来：第一帧 driver 才会把位置和尺寸写上，否则会在 (0,0) 闪一下
      box.style.display = 'none';
      owners.set(box, host);
      layerFor(host).appendChild(box);
      job?.frames.add(box);
      return { box, badge };
    };

    /** 把视口矩形换算进「这一节」的坐标系，写进框。 */
    const placeBox = (
      box: HTMLElement,
      rect: { left: number; top: number; width: number; height: number },
    ) => {
      const base = baseOf(box);
      box.style.cssText = `display:block;left:${rect.left - base.left}px;top:${rect.top - base.top}px;width:${rect.width}px;height:${rect.height}px`;
    };

    const retire = (box: HTMLElement) => {
      box.classList.add('rv-leaving');
      window.setTimeout(() => box.remove(), 800);
    };

    /* ---------------- 文字索引 ---------------- */
    const collectText = (
      el: HTMLElement,
    ): { chars: string[]; nodes: Text[] } => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      const text = nodes.map((node) => node.data).join('');
      // CJK 补一个空占位：让它多占一拍，中西混排的节奏才不塌
      const chars = Array.from(text).flatMap((char) =>
        /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)
          ? [char, '']
          : [char],
      );
      return { chars, nodes };
    };

    /** 把「写到第 n 个 chars 单位」映射成 DOM 的 (节点, 偏移)。 */
    const locate = (
      nodes: Text[],
      chars: string[],
      n: number,
    ): [Text, number] | null => {
      let rest = textOffsetAt(chars, n);
      for (let i = 0; i < nodes.length; i += 1) {
        const length = nodes[i].length;
        if (rest < length || i === nodes.length - 1)
          return [nodes[i], Math.min(rest, length)];
        rest -= length;
      }
      return null;
    };

    type CaretBox = { left: number; top: number; height: number };

    /**
     * 笔尖位置：直接取「还没写完那一段」Range 的起点。
     *
     * 这是唯一可信的插入点——CSS Custom Highlight 收口用的就是这个 Range，
     * 所以「文字露到哪」与「笔尖停在哪」不可能不一致。
     *
     * 旧实现（已删）用字符下标自己再算一遍 DOM 偏移，还把偏移 clamp 到
     * `length - 1`：只要真正的插入点落在某个文本节点的末尾（段落被行内元素
     * 或 CJK 占位符切开时很常见），笔尖就会被拉回前一个字的左边，
     * 看上去就是「停在下一个字的前面」。
     */
    const caretBox = (item: SceneItem): CaretBox | null => {
      const untyped = item.range;
      if (untyped) {
        const rect = untyped.getClientRects()[0];
        if (rect)
          return { left: rect.left, top: rect.top, height: rect.height };
      }
      // 已经写完（Range 收口为 null）：笔尖停在最后一个字的右边缘。
      for (let i = item.nodes.length - 1; i >= 0; i -= 1) {
        const node = item.nodes[i];
        if (node.length === 0) continue;
        const tail = document.createRange();
        tail.setStart(node, node.length - 1);
        tail.setEnd(node, node.length);
        const rect = tail.getClientRects()[0];
        if (rect)
          return { left: rect.right, top: rect.top, height: rect.height };
      }
      return null;
    };

    let highlight: Highlight | null = null;
    if (supportsHighlight) {
      highlight = new Highlight();
      CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    }

    /** 揭示到第 n 个单位。有 Highlight 就用 Range 收口（不动 DOM）。 */
    const revealText = (item: SceneItem, n: number) => {
      if (n === item.shown) return;
      item.shown = n;
      const done = n >= item.chars.length;
      if (!item.range) return;
      if (!highlight) {
        // 没有 Highlight API：整块直接显示
        if (done) item.range = null;
        return;
      }
      if (done) {
        highlight.delete(item.range);
        item.range = null;
        return;
      }
      const spot = locate(item.nodes, item.chars, n);
      if (spot) item.range.setStart(spot[0], spot[1]);
    };

    /* ---------------- 各类内容的排程 ---------------- */

    /** 文字：走过去、按住、按打字计划逐字揭示，边写边量。 */
    const scheduleText = (
      el: HTMLElement,
      startAt: number,
      framed: boolean,
      group?: { hands: Hand[]; start?: number },
    ) => {
      const { chars, nodes } = collectText(el);
      if (chars.length === 0) {
        at(startAt, () => el.setAttribute('data-rv-done', ''));
        return startAt;
      }

      const item: SceneItem = {
        el,
        kind: 'text',
        chars,
        nodes,
        range: null,
        shown: 0,
      };
      if (highlight) {
        const range = document.createRange();
        range.selectNodeContents(el);
        highlight.add(range);
        item.range = range;
        job?.ranges.add(range);
      }

      // 光标跟踪的是「文字首行左侧」——用 Range 实时取，换行也跟得上
      const anchor: Target = {
        get: () => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rect = range.getClientRects()[0] ?? el.getBoundingClientRect();
          return { x: rect.left + 1, y: rect.top + rect.height / 2 };
        },
      };

      const hand = claim(anchor, startAt, group?.hands);
      if (!hand) return startAt;

      /*
       * 文字块也先「量」一遍再写。
       *
       * 之前只有 [data-rv="frame"] 的卡片有这一步，段落是直接以完整尺寸冒出一个框——
       * 读者看到的就是「框突然出现、手没拉过它」。现在段落走同一套：
       * 光标落到左上角 → 按住 → 拖到右下角（框跟着手长、徽章报数）→ 再回到文字起点写。
       */
      const boxRect = el.getBoundingClientRect();
      // 量框的那个框：先声明，等 typeEnd 算出来再决定什么时候收
      let textFrame: ReturnType<typeof makeFrame> | null = null;
      if (
        framed &&
        chars.length >= 16 &&
        boxRect.width > 40 &&
        boxRect.height > 24
      ) {
        const arrive = moveTo(
          hand,
          { el, fx: 0, fy: 0 },
          startAt,
          Math.min(boxRect.width, boxRect.height, 48),
          'cross',
        );
        const press = Math.max(arrive + dwellMs(rng), startAt);
        const measured =
          press + measureDurationMs(boxRect.width, boxRect.height);
        hold(hand, arrive, press, 'cross');
        glide(hand, { el, fx: 1, fy: 1 }, press, measured, 'cross', true);
        const box = makeFrame(sectionOf(el), 'rv-frame--text');
        textFrame = box;
        during(press, measured, (p) => {
          // 每帧现取目标的矩形：框贴着内容长，滚动/重排都不会错位
          const live = el.getBoundingClientRect();
          const size = frameSizeAt(live, p);
          placeBox(
            box.box,
            new DOMRect(live.left, live.top, size.width, size.height),
          );
          box.badge.textContent = `${size.width} × ${size.height}`;
        });
        // 不再在这里收框：等 typing 结束（见下面的 keepFrame）
        // 量完再把笔挪回文字起点写字
        startAt = measured + 80;
      }

      // 同一块内容的第二支手：错开 7px / 5px 站着，先「撞」一下
      if (group && group.start !== undefined && group.hands.length > 0) {
        const offset: Target = {
          get: () =>
            shift(
              resolveTarget(anchor),
              7 * group.hands.length,
              5 * (group.hands.length % 2 ? 1 : -1),
            ),
        };
        const bumpAt = group.start + rng() * 90;
        const arrived = moveTo(hand, offset, bumpAt, 20, 'ibeam');
        const press = Math.max(arrived, bumpAt);
        hold(hand, arrived, press, 'ibeam');
        hold(hand, press, press + 90, 'ibeam', true);
        at(group.start + 60, () => {
          const clash = makeFrame(sectionOf(el), 'rv-clash');
          clash.badge.textContent = '×';
          const rect = el.getBoundingClientRect();
          placeBox(
            clash.box,
            new DOMRect(
              rect.left - 3,
              rect.top - 2,
              rect.width + 6,
              rect.height + 4,
            ),
          );
          window.setTimeout(() => retire(clash.box), 420);
        });
        hold(
          hand,
          press + 90,
          Math.max(press + 200, group.start + 420),
          'ibeam',
        );
        group.hands.push(hand);
        startAt = Math.max(press + 200, group.start + 420);
      } else if (group) {
        group.hands.push(hand);
      }

      const arrive = moveTo(hand, anchor, startAt, 20, 'ibeam');
      let pressAt = Math.max(arrive + dwellMs(rng), startAt);
      if (group) {
        group.start = pressAt;
        // 第一支手先站住，给后面的手让出「撞」的时机
        pressAt += 480;
      }
      hold(hand, arrive, pressAt, 'ibeam');
      hold(hand, pressAt, pressAt + 90, 'ibeam', true);

      const plan = typingSchedule(chars, { allowTypos: framed }, rng);
      const typeStart = pressAt + 90;
      const typeEnd = typeStart + (plan.at(-1)?.t ?? 0);

      // 框活到这块内容写完（+260ms 喘息）。写字期间框保持「量出来的完整尺寸」不动：
      // 文字是用 highlight 透出来的，布局一个像素都没变，框缩回去再长反而像抖。
      const keepFrame = textFrame;
      if (keepFrame) at(typeEnd + 260, () => retire(keepFrame.box));

      /*
       * 写字时笔尖要贴着「正在写的那一个字」走。
       * 位置每帧从 Range 现取（写到哪里、光标就在哪里，写到行尾跟到下一行），
       * 而不是"文字起点 + 固定偏移"——那是两张皮，看着不连贯。
       */
      const frontier = (): Point => {
        const box = caretBox(item);
        return box
          ? { x: box.left, y: box.top + box.height / 2 }
          : resolveTarget(anchor);
      };
      hand.acts.push({
        t0: typeStart,
        t1: Math.max(typeEnd, typeStart + 200),
        from: hand.at,
        to: hand.at,
        tool: 'ibeam',
        down: false,
        path: () => frontier(),
        // 不设每帧位移上限：打字的目标位置是连续移动的，限速只会在低帧率下
        // 把笔尖拖在文字后面（1fps 时每帧 55px，追不上约 280px/s 的写字速度）。
        follow: 4000,
      });
      hand.at = { get: frontier };
      hand.free = Math.max(hand.free, typeEnd);

      const slip = plan.some((step) => step.extra)
        ? makeSlip(sectionOf(el))
        : null;

      during(typeStart, typeEnd, (progress, now) => {
        // 找到当前这一拍
        let index = -1;
        while (index + 1 < plan.length && plan[index + 1].t <= now - typeStart)
          index += 1;
        const step: TypingStep | undefined =
          progress < 1 ? plan[index] : undefined;
        revealText(item, progress < 1 ? (step?.n ?? 0) : chars.length);
        if (slip) paintSlip(slip, item, step?.n ?? 0, step?.extra ?? '');
      });

      at(typeStart, () => {
        // 内容在「开始写」这一刻才现身，之前只有一个空框——顺序不能反
        markDone(el);
      });
      at(typeEnd, () => {
        slip?.remove();
      });
      return typeEnd;
    };

    /** 打错的字符：贴着原字的位置画一个「错字」，退格时逐个消失。 */
    const makeSlip = (host: HTMLElement) => {
      const node = document.createElement('span');
      node.className = 'rv-slip';
      node.style.display = 'none';
      owners.set(node, host);
      layerFor(host).appendChild(node);
      job?.slips.add(node);
      return node;
    };

    const paintSlip = (
      slip: HTMLElement,
      item: SceneItem,
      n: number,
      extra: string,
    ) => {
      if (!extra) {
        slip.style.display = 'none';
        return;
      }
      const spot = locate(item.nodes, item.chars, n);
      if (!spot) {
        slip.style.display = 'none';
        return;
      }
      // 错字画在「笔尖」上，而不是画在同一个字符格子里：两者在节点边界上
      // 会差一个字（和 frontier 是同一个坑）。
      const caret = caretBox(item);
      const host = spot[0].parentElement;
      if (!caret || !host) {
        slip.style.display = 'none';
        return;
      }
      const rect = {
        left: caret.left,
        right: caret.left,
        top: caret.top,
        height: caret.height,
      };
      const base = baseOf(slip);
      const style = getComputedStyle(host);
      slip.textContent = extra;
      slip.style.display = '';
      slip.style.cssText = `display:block;left:${rect.left - base.left}px;top:${rect.top - base.top}px;height:${rect.height}px;line-height:${rect.height}px;font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight};font-style:${style.fontStyle};letter-spacing:${style.letterSpacing};color:${style.color}`;
    };

    /** 框：走过去、按住、从左上拖到右下，徽章实时报数，画满即揭示并轻微上浮。 */
    const scheduleFrame = (el: HTMLElement, startAt: number) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        at(startAt, () => el.setAttribute('data-rv-done', ''));
        return startAt;
      }
      const topLeft: Target = { el, fx: 0, fy: 0 };
      const bottomRight: Target = { el, fx: 1, fy: 1 };

      const hand = claim(topLeft, startAt);
      if (!hand) return startAt;

      const arrive = moveTo(
        hand,
        topLeft,
        startAt,
        Math.min(rect.width, rect.height, 48),
        'cross',
      );
      const press = Math.max(arrive + dwellMs(rng), startAt);
      const end = press + measureDurationMs(rect.width, rect.height);

      hold(hand, arrive, press, 'cross');
      glide(hand, bottomRight, press, end, 'cross', true);
      hold(hand, end, end + 70, 'cross');

      const frame = makeFrame(
        sectionOf(el),
        `rv-frame--${el.dataset.rv ?? 'frame'}`,
      );
      during(press, end, (progress) => {
        // 每帧现取目标的矩形再换算：量框的过程中页面滚了，框也不会落在旧位置。
        const live = el.getBoundingClientRect();
        const box = frameSizeAt(live, progress);
        placeBox(
          frame.box,
          new DOMRect(live.left, live.top, box.width, box.height),
        );
        frame.badge.textContent = `${box.width} × ${box.height}`;
      });

      at(end, () => {
        markDone(el);
        el.classList.add('rv-arrive');
        el.addEventListener(
          'animationend',
          () => el.classList.remove('rv-arrive'),
          { once: true },
        );
      });
      // 这里不再自己定时收框：由 play() 在本节内容全部写完后统一收，
      // 否则框里的文字还在写，框就先没了。
      return end;
    };

    /** 数字：一段固定窗口滚到真值。 */
    const scheduleCount = (el: HTMLElement, startAt: number) => {
      const raw = el.dataset.rvCount ?? '';
      const target = Number(raw);
      const decimals = raw.split('.')[1]?.length ?? 0;
      el.style.display = 'inline-block';
      el.style.minWidth = `${el.getBoundingClientRect().width}px`;
      el.textContent = target.toFixed(decimals);

      const hand = claim({ el, fx: 0.5, fy: 1 }, startAt);
      const end = startAt + COUNT_MS;
      const arrive = hand
        ? moveTo(hand, { el, fx: 1, fy: 0.5 }, startAt, 24, 'resize')
        : startAt;
      // 数字等光标到了再出现，不要抢在手前面
      at(arrive, () => markDone(el));
      during(startAt, end, (progress) => {
        el.textContent =
          progress < 1 ? countUpAt(target, progress).toFixed(decimals) : raw;
      });
      if (hand) hold(hand, arrive, end, 'resize');
      return end;
    };

    /** 图表：笔沿这一行走一遍，clip 跟着笔尖推进。 */
    const scheduleLine = (el: HTMLElement, startAt: number) => {
      const hand = claim({ el, fx: 0, fy: 0.5 }, startAt);
      if (!hand) {
        at(startAt, () => el.classList.add('is-written'));
        return startAt;
      }
      const arrive = moveTo(hand, { el, fx: 0, fy: 0.5 }, startAt, 12, 'pen');
      const press = Math.max(arrive + dwellMs(rng), startAt);
      const end = press + 700;
      hold(hand, arrive, press, 'pen');
      hand.acts.push({
        t0: press,
        t1: end,
        from: { el, fx: 0, fy: 0.5 },
        to: { el, fx: 1, fy: 0.5 },
        tool: 'pen',
        down: true,
        bow: 0,
      });
      hand.free = end;
      at(press, () => {
        markDone(el);
        el.classList.add('rv-tracing');
      });
      during(press, end, (progress) => {
        el.style.setProperty(
          '--rv-clip',
          `${Math.round((1 - progress) * 100)}%`,
        );
      });
      at(end, () => {
        el.classList.add('is-written');
        el.style.removeProperty('--rv-clip');
        el.classList.remove('rv-tracing');
      });
      return end;
    };

    /* ---------------- 分节播放（对齐 winc.si：滚动到才播、离开就取消） ---------------- */
    type SectionState = {
      job: Job | null;
      timer: number;
      io: IntersectionObserver | null;
      visible: boolean;
      played: boolean;
    };
    const sections = new Map<HTMLElement, SectionState>();

    /* 一次只演一节：后来的节在 queue 里等，playingSection 是当前占着舞台的那节。 */
    const queue: HTMLElement[] = [];
    let playingSection: HTMLElement | null = null;
    let playingUntil = 0;
    let pumpTimer = 0;

    /** 一节里的所有内容块；root 自己那一节排除掉有 [data-rv-section] 祖先的。 */
    const itemsOf = (sectionEl: HTMLElement): HTMLElement[] =>
      sectionEl === root
        ? Array.from(root.querySelectorAll<HTMLElement>('[data-rv]')).filter(
            (el) => !el.closest('[data-rv-section]'),
          )
        : Array.from(sectionEl.querySelectorAll<HTMLElement>('[data-rv]'));

    /* ---------------- 参考站的两条额外机制 ---------------- */

    /**
     * 自动收集「文本叶子」：没有子元素、有可见文字、且自己没被打过 `data-rv` 标记。
     * 参考站就是靠这一条「把整页内容画出来」的——不必给每个节点手写属性；
     * `data-instant` 里的子树跳过（立刻出现，不逐字）。
     */
    const autoLeaves = (sectionEl: HTMLElement): HTMLElement[] =>
      Array.from(sectionEl.querySelectorAll<HTMLElement>('*')).filter((el) => {
        if (el.children.length > 0) return false;
        if (!el.textContent || el.textContent.trim() === '') return false;
        if (el.hasAttribute('data-rv')) return false;
        if (el.closest('[data-instant]')) return false;
        if (el.closest('.rv-layer, .rv-hands')) return false;
        if (sectionEl === root && el.closest('[data-rv-section]')) return false;
        return true;
      });

    /*
     * 自动收集到的叶子也要在开演前藏起来：否则文字先露面、光标再「写」一遍，
     * 就成了描红。样式表的隐藏规则挂在 `html[data-rv-play=1]` 上，这里给叶子
     * 补一个 `data-rv-text` 让规则能选中它们。
     *
     * 放在 effect 里做是因为这些叶子运行时才知道；被包住的区块都在折叠线以下，
     * 不会出现「先看见、再消失」的闪烁。
     */
    for (const leaf of autoLeaves(root)) leaf.setAttribute('data-rv-text', '');

    /** `[data-highlight]`：已存在的内容先压暗，再由一支手扫过去逐个点亮。 */
    const scheduleHighlight = (lights: HTMLElement[], startAt: number) => {
      // 这两件事必须一起做：压暗（视觉上「还没点亮」）+ 标 done（解除
      // 「开演前先藏起来」那条规则）。少了后者，这些块会被 CSS 一直藏着——
      // 高亮作业不写字，所以没有人会替它们标 done。
      for (const el of lights) {
        markDone(el);
        el.classList.add('rv-unlit');
      }
      const first = lights[0];
      const hand = claim({ el: first, fx: 0, fy: 0.5 }, startAt);
      if (!hand) {
        for (const el of lights)
          at(startAt, () => el.classList.remove('rv-unlit'));
        return;
      }
      const arrive = moveTo(
        hand,
        { el: first, fx: 0, fy: 0.5 },
        startAt,
        24,
        'arrow',
      );
      hold(hand, startAt, arrive, 'arrow');
      let t = arrive + 60;
      for (const el of lights) {
        glide(hand, { el, fx: 1, fy: 0.5 }, t, t + 200, 'arrow');
        at(t + 180, () => el.classList.remove('rv-unlit'));
        t += 190;
      }
    };

    const newJob = (): Job => ({
      events: new Set(),
      drivers: new Set(),
      hands: new Set(),
      frames: new Set(),
      slips: new Set(),
      ranges: new Set(),
      revealed: new Set(),
    });

    /** 撤掉一节的作业：事件、驱动、选框、错字、高亮、已揭示状态全部回收。 */
    const cancelJob = (finished: Job) => {
      for (const entry of finished.events) {
        const i = events.indexOf(entry);
        if (i >= 0) events.splice(i, 1);
      }
      for (const entry of finished.drivers) {
        const i = drivers.indexOf(entry);
        if (i >= 0) drivers.splice(i, 1);
      }
      finished.events.clear();
      finished.drivers.clear();
      for (const frame of finished.frames) frame.remove();
      for (const slip of finished.slips) slip.remove();
      if (highlight)
        for (const range of finished.ranges) highlight.delete(range);
      for (const el of finished.revealed) el.removeAttribute('data-rv-done');
      const now = performance.now();
      for (const hand of finished.hands) {
        hand.acts = [];
        hand.at = { at: hand.pos };
        hand.free = now;
      }
    };

    const play = (sectionEl: HTMLElement) => {
      const state = sections.get(sectionEl);
      if (!state || state.job) return;
      const startNow = performance.now();
      job = newJob();
      state.job = job;
      state.played = true;
      // 同一块里的多支手共用一个 group：第二支手要错开 7px/5px、并且「撞」一下
      const textGroups = new Map<
        HTMLElement,
        { hands: Hand[]; start?: number }
      >();
      const frameEnds = new Map<HTMLElement, number>();
      const lights: HTMLElement[] = [];

      /*
       * 一节之内的块是并行的，不串行：每块只等「自己所在的框」画完
       * （框里的文字在框结束后 +80ms 开写），彼此不排队——队形靠手数自然错开。
       * 跨节则是懒的：滚动到哪一节才排哪一节（见下面每个 section 的 IO）。
       */
      for (const el of itemsOf(sectionEl)) {
        const kind = el.dataset.rv ?? 'frame';
        if (kind === 'frame') {
          const end = scheduleFrame(el, startNow);
          // 框里的文字等框画完再写（自动收集的叶子按 frameEnds 排队）
          frameEnds.set(el, end);
        } else if (kind === 'text') {
          const group = textGroups.get(el.parentElement ?? root);
          if (group) {
            scheduleText(el, startNow + 80, true, group);
          } else {
            const created = {
              hands: [] as Hand[],
              start: undefined as number | undefined,
            };
            textGroups.set(el.parentElement ?? root, created);
            scheduleText(el, startNow + 80, true, created);
          }
        } else if (kind === 'type') {
          // 标题：先缩到 46%，再用 resize 光标把它「拉大」
          const hand = claim({ el, fx: 1, fy: 1 }, startNow);
          el.style.transformOrigin = '0 0';
          el.style.scale = String(HEADLINE_SCALE);
          const revealTitle = () => markDone(el);
          if (hand) {
            const arrive = moveTo(
              hand,
              { el, fx: 1, fy: 1 },
              startNow,
              10,
              'resize',
            );
            const start = Math.max(arrive, startNow) + dwellMs(rng);
            const end = start + 540;
            hold(hand, arrive, start, 'resize');
            hold(hand, start, end, 'resize', true);
            // 标题在光标按住的那一刻才现身，之前连缩小的影子都不露
            at(start, revealTitle);
            during(start, end, (progress) => {
              const eased = easeGrow(progress);
              el.style.scale = String(
                HEADLINE_SCALE + (1 - HEADLINE_SCALE) * eased,
              );
              // 参考站的 [data-type] 是 clip-path 擦除式揭示：一边拉大一边擦出来
              el.style.clipPath = `inset(0 ${((1 - eased) * 100).toFixed(2)}% 0 0)`;
            });
            at(end, () => {
              el.style.scale = '';
              el.style.transformOrigin = '';
              el.style.clipPath = '';
            });
          } else {
            // 没有手可用时也不能把标题永远藏着
            at(startNow, revealTitle);
          }
        } else if (kind === 'count') {
          scheduleCount(el, startNow);
        } else if (kind === 'line') {
          scheduleLine(el, startNow);
        } else if (kind === 'highlight') {
          lights.push(el);
        }
      }

      // 没被打标的文本叶子自动逐个写：整页内容都能画，不必手写属性。
      // 在框里的叶子等自己的框结束后 +80ms 才开写（和框内文字的旧行为一致）。
      for (const leaf of autoLeaves(sectionEl)) {
        const framed = leaf.closest<HTMLElement>('[data-rv="frame"]');
        const frameEnd = framed ? frameEnds.get(framed) : undefined;
        /*
         * 已经在「卡片框」里的文字不再自己量一遍：一张卡一个框，卡里的字就在这个
         * 框里写。旧版给每段文字都配一个框，四张卡叠出十一个框，一半是重复的。
         */
        scheduleText(leaf, (frameEnd ?? startNow) + 80, !framed);
      }

      // `[data-highlight]`：已有内容先压暗，再被一支手扫亮。
      if (lights.length > 0) scheduleHighlight(lights, startNow);

      // 框要活到这一节的内容全部写完再收：原来每块框自己 420ms 就 retire，
      // 卡片的文字还没写完框就先消失了（这就是「东西没画完框就没了」）。
      const contentEnd = jobEnd(job);
      for (const frameEl of job.frames)
        at(contentEnd + 260, () => retire(frameEl));

      // 排完就把指针交还：之后创建的事件/驱动都属于别的节
      playingSection = sectionEl;
      playingUntil = contentEnd;
      job = null;
      kick();
      pump();
    };

    /** 一份作业最晚排到什么时候——用来决定下一节该等多久。 */
    const jobEnd = (target: Job | null) => {
      let end = performance.now();
      if (!target) return end;
      for (const event of target.events) end = Math.max(end, event.t);
      for (const driver of target.drivers) end = Math.max(end, driver.t1);
      return end;
    };

    /*
     * 一次只演一节。视口够高时两节会同时进入视野（横屏笔记本尤其明显），
     * 若各自立刻开演，就是十几支手一起飞、两处同时写字——看着乱，
     * 也不像「边滚边画」。所以后来的排队，等上一节画完或被滚走再开始。
     */
    const pump = () => {
      window.clearTimeout(pumpTimer);
      pumpTimer = 0;
      if (stopped) return;
      if (playingSection) {
        const left = playingUntil - performance.now();
        if (left > 0) {
          pumpTimer = window.setTimeout(pump, left + SECTION_GAP_MS);
          return;
        }
        // 上一节已经画完（不是被滚走）：交还舞台，别把后面那节一直扣着
        playingSection = null;
        playingUntil = 0;
      }
      while (queue.length > 0) {
        const next = queue.shift()!;
        const state = sections.get(next);
        if (!state || state.job || !state.visible) continue;
        play(next);
        return; // play 里会再调 pump，把下一节的等待排上
      }
    };

    /*
     * 兜底：8 秒后把「已经滚到、却一个动作都没排上」的节直接放开。
     * 只放这些——把还没滚到的节一起放开，懒加载就白做了。
     */
    const failsafe = window.setTimeout(() => {
      for (const [sectionEl, state] of sections) {
        if (!state.visible || state.played) continue;
        for (const el of sectionEl.querySelectorAll<HTMLElement>(
          '[data-rv], [data-rv-text]',
        )) {
          el.setAttribute('data-rv-done', '');
        }
      }
    }, 8000);

    /*
     * 每一节一个观察器：进入视口 → 去抖 160ms → 只播这一节；离开 → 立刻取消这一节。
     * 这是 winc.si 的做法（`[data-section]` + rootMargin -12% + 160ms 去抖 + 离场 be(job)），
     * 也是「边滚边加载边画」的来源：没滚到的节一个动作都不排。
     */
    const sectionEls = Array.from(
      root.querySelectorAll<HTMLElement>('[data-rv-section]'),
    );
    // 有标记的块，或者有可自动收集的文本叶子，都算「这一节有内容要画」。
    if (itemsOf(root).length > 0 || autoLeaves(root).length > 0)
      sectionEls.push(root);
    for (const sectionEl of sectionEls) {
      const state: SectionState = {
        job: null,
        timer: 0,
        io: null,
        visible: false,
        played: false,
      };
      sections.set(sectionEl, state);
      state.io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              state.visible = true;
              if (state.job || queue.includes(sectionEl)) continue;
              window.clearTimeout(state.timer);
              state.timer = window.setTimeout(() => {
                window.clearTimeout(failsafe);
                if (state.job || queue.includes(sectionEl)) return;
                queue.push(sectionEl);
                pump();
              }, SECTION_DEBOUNCE_MS);
            } else {
              window.clearTimeout(state.timer);
              state.visible = false;
              const parked = queue.indexOf(sectionEl);
              if (parked >= 0) queue.splice(parked, 1);
              if (state.job) {
                cancelJob(state.job);
                state.job = null;
              }
              // 正在演的这一节被滚走了：把舞台让给还在视口里的下一节
              if (playingSection === sectionEl) {
                playingSection = null;
                playingUntil = 0;
                pump();
              }
            }
          }
        },
        { rootMargin: '0px 0px -12% 0px' },
      );
      state.io.observe(sectionEl);
    }

    return () => {
      stopped = true;
      window.clearTimeout(failsafe);
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(pumpTimer);
      queue.length = 0;
      playingSection = null;
      playingUntil = 0;
      for (const state of sections.values()) {
        window.clearTimeout(state.timer);
        state.io?.disconnect();
        if (state.job) cancelJob(state.job);
        state.job = null;
      }
      window.removeEventListener('scroll', onScroll);
      if (highlight) CSS.highlights.delete(HIGHLIGHT_NAME);
      events.length = 0;
      drivers.length = 0;
      for (const hand of hands) hand.el.remove();
      for (const el of root.querySelectorAll<HTMLElement>(
        '[data-rv], [data-rv-text]',
      )) {
        el.removeAttribute('data-rv-done');
        el.classList.remove('rv-arrive', 'is-written', 'rv-tracing');
        el.style.removeProperty('--rv-clip');
        if (el.dataset.rv === 'count') {
          const raw = el.dataset.rvCount ?? '';
          el.textContent = raw;
          el.style.display = '';
          el.style.minWidth = '';
        }
        el.style.scale = '';
        el.style.transformOrigin = '';
      }
      for (const [host, layer] of layers) {
        layer.remove();
        host.classList.remove('rv-layer-host');
      }
      layers.clear();
      handLayer.remove();
    };
  }, [take, swarm]);

  return (
    <div ref={rootRef} className={`rv-scene ${className}`.trim()}>
      {children}
      {replayable ? (
        <button
          type="button"
          className="rv-replay"
          onClick={() => setTake((n) => n + 1)}
        >
          重播
        </button>
      ) : null}
    </div>
  );
}
