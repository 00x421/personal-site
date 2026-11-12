/**
 * 揭示层的运动与打字模型（纯函数，不碰 DOM）。
 *
 * 这一份是**按 winc.si 的真实实现逐条对齐**的，不是自己估的。
 * 之前那版用的是「固定 220ms 直线飞过去 + 固定 24ms 一个字」，
 * 看起来像动画；而真实效果的「像有人在操作」来自下面这几件事：
 *
 * 1. 移动时长只与距离**对数**相关（`handTravelMs`）——近处不会一闪而过，
 *    远处也不会飞很久；
 * 2. 每次移动都**先冲过目标点再纠正**（`detourPoint`），并且走弧线（`bowPoint`）：
 *    手不会走直线；
 * 3. 打字是**带抖动和错字的节奏**（`typingSchedule`）：空格后停久一点、
 *    标点后停更久、大写字母略慢；约 1/60 的概率打错一个键，
 *    然后把错字一个个退掉再继续。
 *
 * 第 3 条是「写字」和「文字逐字出现」的全部区别。
 */

/** 把值夹进区间。 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 标准正态随机数（Box–Muller）。
 *
 * 手写输入的时间间隔不是均匀分布，而是集中在某个值附近、偶尔很长。
 * 高斯才像手；`random()*range` 像节拍器。
 */
export function gauss(rng: () => number): number {
  const u = Math.sqrt(-2 * Math.log(rng() || 1e-9));
  return u * Math.cos(2 * Math.PI * rng());
}

/**
 * 移动用时：`(120 + 140·log2(距离/基准 + 1)) · 系数`。
 *
 * 基准 24px 以内都算「挪一下」；系数是全局快慢（上游用 0.52）。
 * 对数而不是线性：屏幕上一百像素和一千像素的差别，落在时间里
 * 只有一倍多，不会出现「远处飞三秒」。
 */
export function handTravelMs(distance: number, reference: number, factor: number): number {
  return (120 + 140 * Math.log2(distance / Math.max(reference, 6) + 1)) * factor;
}

/** 停一下的时长：围绕 95ms 的高斯抖动。 */
export function dwellMs(rng: () => number): number {
  return Math.exp(Math.log(95) + 0.35 * gauss(rng));
}

/**
 * 同时登场的光标数：按视口面积给，`clamp(面积/110000, 4, 14)`。
 *
 * 桌面 1440×900 约 12 支，手机约 4 支。数量是「多人协作」这个错觉的一半；
 * 三支永远像演示，十几支才像有人在你旁边干活。
 */
export function handCountFor(area: number): number {
  return Math.round(clamp(area / 110000, 4, 14));
}

/** 视口四个边缘的入口点：挑离当前位置最近的那条边。 */
export function edgePoint(
  from: { x: number; y: number },
  viewport: { width: number; height: number },
): { x: number; y: number } {
  const distances = [from.x, viewport.width - from.x, from.y, viewport.height - from.y];
  const nearest = distances.indexOf(Math.min(...distances));
  const x = clamp(from.x, 0, viewport.width);
  const y = clamp(from.y, 0, viewport.height);
  return [
    { x: -40, y },
    { x: viewport.width + 40, y },
    { x, y: -40 },
    { x, y: viewport.height + 40 },
  ][nearest];
}

/**
 * 冲过目标点的落点。
 *
 * 75% 的机会「过头」（沿行进方向多走 2%–7%），25% 的机会「不及」（-60% 幅度），
 * 再叠一个垂直方向的随机抖动（最多 18px）。随后光标会从这里纠正到真目标，
 * 于是轨迹是两段折线加一个转角——这正是手在操作的样子。
 *
 * 偏差小于 1.5px 时返回 null，表示直接到位、不要两段。
 */
export function detourPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rng: () => number,
): { x: number; y: number } | null {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 2) return null;
  const forward = (rng() < 0.75 ? 1 : -0.6) * (0.02 + rng() * 0.05);
  const sideways = Math.min(distance * 0.04, 18) * (rng() - 0.5);
  const ux = (to.x - from.x) / distance;
  const uy = (to.y - from.y) / distance;
  const dx = -ux * distance * forward - uy * sideways;
  const dy = -uy * distance * forward + ux * sideways;
  if (Math.hypot(dx, dy) < 1.5) return null;
  return { x: to.x + dx, y: to.y + dy };
}

/** 弧线的横向偏移：`bow · sin(π·进度)`，正负决定往哪边弯。 */
export function bowOffset(bow: number, progress: number): number {
  return bow * Math.sin(Math.PI * progress);
}

/**
 * 带弧线的插值：在 from→to 的直线上，把点沿法线方向推开 `bowOffset`。
 *
 * 这就是「手不是机器人」最便宜的一条：直线位移只改一个参数，
 * 弧线位移什么都不改，观感差一档。
 */
export function bowedPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  eased: number,
  bow: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const offset = bowOffset(bow, eased);
  return {
    x: from.x + dx * eased - dy * offset,
    y: from.y + dy * eased + dx * offset,
  };
}

/** 打错字时要替换成的那个键：QWERTY 邻键；中文则取文中另一个汉字。 */
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;
const PUNCTUATION = /[,.;:!?，。；：！？、]/;
/** 打错字的概率：约每 60 个字错一次。 */
export const TYPO_RATE = 60;

export function typoFor(char: string, text: string, rng: () => number): string | null {
  const lower = char.toLowerCase();
  for (const row of KEY_ROWS) {
    const index = row.indexOf(lower);
    if (index < 0) continue;
    const pick =
      index === 0
        ? 1
        : index === row.length - 1
          ? index - 1
          : index + (rng() < 0.5 ? -1 : 1);
    return char === lower ? row[pick] : row[pick].toUpperCase();
  }
  if (CJK.test(char)) {
    const pool = Array.from(new Set(text)).filter((c) => c !== char && CJK.test(c));
    return pool.length > 0 ? pool[Math.floor(rng() * pool.length)] : null;
  }
  return null;
}

/** 打字计划里的一拍。 */
export type TypingStep = {
  /** 相对打字开始的毫秒数（已经过整体压缩）。 */
  t: number;
  /** 这一刻应当已经写出的字符数（`chars` 下标，含占位）。 */
  n: number;
  /** 正在显示的错误字符（错字回退期间非空）。 */
  extra: string;
};

/** 打字计划参数。 */
export type TypingOptions = {
  /** 每个字的基准间隔。上游用 50ms。 */
  baseMs?: number;
  /** 是否允许打错字（标题缩放过的不允许，否则观感太乱）。 */
  allowTypos?: boolean;
  /** 整体压到多长以内就开始加速。上游用 1200ms。 */
  budgetMs?: number;
};

/**
 * 生成打字计划。
 *
 * 每个字的间隔 = `exp(ln(base) + 0.35·gauss)`，再按前一个字符加权：
 * 空格后 ×1.5、标点后 ×1.9、大写字母 ×1.2。约 1/60 的字会打错：
 * 先打错一个键、再多打 1–2 个、停 240–460ms，然后逐字退格（每字 70–110ms），
 * 停 110ms 再继续。**打字的总时长再整体压缩**到 1200ms 左右
 * （`clamp(总时长/1200, 1, 4)` 的倒数），长段落不会拖成五秒。
 *
 * `chars` 里的空串是占位（CJK 被折成 `[字, '']`，让它多占一拍），
 * 占位不耗时也不推进字符数。
 */
export function typingSchedule(
  chars: readonly string[],
  options: TypingOptions = {},
  rng: () => number = Math.random,
): TypingStep[] {
  const { baseMs = 50, allowTypos = true, budgetMs = 1200 } = options;
  const text = chars.join('');

  const delayAt = (index: number): number => {
    if (chars[index] === '') return 0;
    const previous = chars[index - 1] ?? ' ';
    let delay = Math.exp(Math.log(baseMs) + 0.35 * gauss(rng));
    if (/\s/.test(previous)) delay *= 1.5;
    if (PUNCTUATION.test(previous)) delay *= 1.9;
    if (/[A-Z]/.test(chars[index])) delay *= 1.2;
    return delay;
  };

  const steps: TypingStep[] = [];
  let clock = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const wrong =
      allowTypos && i > 1 && i < chars.length - 4 && rng() < 1 / TYPO_RATE
        ? typoFor(chars[i], text, rng)
        : null;

    if (wrong) {
      let ghost = wrong;
      clock += delayAt(i);
      steps.push({ t: clock, n: i, extra: ghost });
      // 多打 1–2 个真字，让「打错了」有上下文
      const extras = 1 + Math.floor(rng() * 2);
      for (let k = 1; k <= extras; k += 1) {
        ghost += chars[i + k];
        clock += delayAt(i + k);
        steps.push({ t: clock, n: i, extra: ghost });
      }
      // 停一下，发现打错了
      clock += 240 + rng() * 220;
      // 逐字退格
      while (ghost) {
        ghost = Array.from(ghost).slice(0, -1).join('');
        clock += 70 + rng() * 40;
        steps.push({ t: clock, n: i, extra: ghost });
      }
      clock += 110;
    }

    clock += delayAt(i);
    steps.push({ t: clock, n: i + 1, extra: '' });
  }

  // 整体压缩：长段落不许拖成五秒，短段落不加速
  const speedUp = clamp(clock / budgetMs, 1, 4);
  return steps.map((step) => ({ ...step, t: step.t / speedUp }));
}

/**
 * 把「写到第 n 个 chars 单位」映射成文本偏移量。
 *
 * `chars` 里的占位（空串）不占文本，所以不能直接用 n 当偏移。
 */
export function textOffsetAt(chars: readonly string[], n: number): number {
  return chars.slice(0, clamp(n, 0, chars.length)).join('').length;
}

/** 数字滚动：easeOutQuart，收尾慢，读起来像「停在真值上」。 */
export function countUpAt(value: number, progress: number): number {
  if (progress >= 1) return value;
  if (progress <= 0) return 0;
  const remaining = 1 - progress;
  return Math.round(value * (1 - remaining ** 4));
}

/**
 * 拖框/移动共用的缓动：先 `t^0.86` 预扭，再套五次 smoothstep。
 * 起步有加速度，收笔会自己停住。
 */
export function easeGrow(t: number): number {
  const clamped = clamp(t, 0, 1);
  const warped = clamped ** 0.86;
  return warped * warped * warped * (10 - 15 * warped + 6 * warped * warped);
}

/** 选框量到某进度时的大小，取整到像素（徽章数字必须与框一致）。 */
export function frameSizeAt(
  size: { width: number; height: number },
  progress: number,
): { width: number; height: number } {
  const eased = easeGrow(progress);
  return {
    width: Math.round(size.width * eased),
    height: Math.round(size.height * eased),
  };
}

/** 量框时长：按对角线长度对数增长，260–700ms。 */
export function measureDurationMs(width: number, height: number): number {
  return Math.round(
    clamp(170 + 105 * Math.log2(Math.hypot(width, height) / 24 + 1), 260, 700),
  );
}
