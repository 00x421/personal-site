/**
 * 是否播放「光标蜂群绘制」的决策层。
 *
 * 为什么单独抽出来：这条判断有五个条件（减少动效 / 触屏 / 省流量 / 不是第一次来 /
 * 视口够宽），散在组件里就会变成一坨 `&&`，而且没法测。后果也很实在——判断错了
 * 要么让老访客每次重看同一段动画，要么在手机上放一段又慢又费电的演出。
 *
 * 纯函数、零依赖，可在 `node --test` 下直接跑（见 tests/swarm-gate.test.ts）。
 * 读取环境的活儿留给调用方（components/site/swarm-section.tsx）。
 */

/** 记住「已经看过这场演出」的键。看过之后默认不再播。 */
export const SWARM_SEEN_KEY = 'xwsx:swarm-seen';

/**
 * 视口窄于这个宽度就不播：手数按面积给，窄屏只剩 4–6 支，
 * 「一群人在画」的感觉立不住，反而更像卡顿。
 */
export const SWARM_MIN_WIDTH = 900;

export type SwarmEnv = {
  /** 系统「减少动态效果」 */
  reducedMotion: boolean;
  /** 触屏主指针（手机/平板） */
  coarsePointer: boolean;
  /** 浏览器省流量模式 */
  saveData: boolean;
  /** 这台设备之前已经看过一次 */
  seenBefore: boolean;
  /** 视口宽度（px） */
  viewportWidth: number;
  /** URL 带 `?draw=1`：用户明确要求重看 */
  forced: boolean;
};

/**
 * 只有「这次值得演」时才返回 true。
 *
 * `forced` 优先级最高：用户主动要求重看时，除了「减少动态效果」之外一律放行
 * ——减少动效果是系统级无障碍设置，不能被 URL 参数绕过。
 */
export function shouldDraw(env: SwarmEnv): boolean {
  if (env.reducedMotion) return false;
  if (env.forced) return true;
  if (env.coarsePointer) return false;
  if (env.saveData) return false;
  if (env.seenBefore) return false;
  return env.viewportWidth >= SWARM_MIN_WIDTH;
}
