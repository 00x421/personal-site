/**
 * 是否播放「光标蜂群绘制」的决策层。
 *
 * 为什么单独抽出来：这条判断有四个条件（减少动效 / 触屏 / 省流量 / 视口够宽），
 * 散在组件里就会变成一坨 `&&`，而且没法测。后果也很实在——
 * 判断错了要么在手机上放一段又慢又费电的演出，要么在拿鼠标的大屏上什么都不发生。
 *
 * **每次访问都演**：早先这里有一条「看过就不再播」的 localStorage 记忆，
 * 结果站主自己验收时永远看到静态页，读者装了多设备也再没见过第二次。
 * 动画在折叠线以下、不影响首屏指标，重演一遍的成本远小于「效果消失」的困惑，
 * 所以那条记忆被删掉了，`?draw=1` 只保留给「绕过触屏/窄屏/省流量」用。
 *
 * 纯函数、零依赖，可在 `node --test` 下直接跑（见 tests/swarm-gate.test.ts）。
 * 读取环境的活儿留给调用方（components/site/swarm-section.tsx）。
 */

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
  /** 视口宽度（px） */
  viewportWidth: number;
  /** URL 带 `?draw=1`：绕过触屏/省流量的观感判断，明确要求演一场 */
  forced: boolean;
};

/**
 * 只有「这次值得演」时才返回 true。
 *
 * `forced` 优先级仅次于「减少动态效果」：用户主动要求时，触屏、省流量、窄屏都放行
 * ——减少动效是系统级无障碍设置，不能被 URL 参数绕过。
 */
export function shouldDraw(env: SwarmEnv): boolean {
  if (env.reducedMotion) return false;
  if (env.forced) return true;
  if (env.coarsePointer) return false;
  if (env.saveData) return false;
  return env.viewportWidth >= SWARM_MIN_WIDTH;
}
