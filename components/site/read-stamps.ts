'use client';

/**
 * 读者本地的「读完集章」记录：文章页的朱印与 /album 印谱共用同一份快照源。
 *
 * 一切读写都包在 try/catch 里：隐私模式、禁用存储、配额满都可能抛错，
 * 而集章只是仪式——存储不可用时仪式照常，只是不存档。
 *
 * 为什么是 useSyncExternalStore 而不是「挂载后 setState」：
 * 服务端读不到 localStorage，只能渲染空谱；客户端首帧也必须给同一个空谱，
 * 水合完成后才换成真值。`getServerSnapshot` 正是为这件事提供的入口，
 * 同时也让这份数据在同一页内有了唯一的真相来源。
 * 快照按 raw 字符串缓存——同一份 raw 必须返回同一个对象，否则会无限重渲染。
 */
export type Stamps = Record<string, number>;

export const STAMPS_KEY = 'xwsx-read-stamps';

/** 同页写入后的通知事件（storage 事件只在别的标签页触发）。 */
export const STAMP_EVENT = 'xwsx-stamp';

const EMPTY: Stamps = {};
let cachedRaw: string | null = null;
let cachedStamps: Stamps = EMPTY;

function parse(raw: string): Stamps {
  if (!raw) return EMPTY;
  try {
    return JSON.parse(raw) as Stamps;
  } catch {
    return EMPTY;
  }
}

/** 客户端快照：localStorage 原文变了才重建对象。 */
export function getStampsSnapshot(): Stamps {
  let raw = '';
  try {
    raw = localStorage.getItem(STAMPS_KEY) ?? '';
  } catch {
    /* 存储不可用：当作空谱 */
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedStamps = parse(raw);
  }
  return cachedStamps;
}

/** 服务端与首帧水合用的空谱（同一个常量，引用稳定）。 */
export function getEmptyStampsSnapshot(): Stamps {
  return EMPTY;
}

export function subscribeStamps(onChange: () => void): () => void {
  function onStorage(event: StorageEvent) {
    if (!event.key || event.key === STAMPS_KEY) onChange();
  }
  window.addEventListener('storage', onStorage);
  window.addEventListener(STAMP_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(STAMP_EVENT, onChange);
  };
}

/** 记一枚章并通知同页订阅者；抛错交给调用方决定是否静默。 */
export function writeStamp(slug: string, ts: number): void {
  const next = { ...getStampsSnapshot(), [slug]: ts };
  localStorage.setItem(STAMPS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(STAMP_EVENT));
}

export function formatStampDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
