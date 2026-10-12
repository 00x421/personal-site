import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * 公众号对话的持久化小仓库：留言历史 + 站主待回复队列。
 *
 * 单机单进程，一个 JSON 文件足矣。每个变更点同步写盘（留言量级下
 * 开销可忽略），进程重启不丢。路径可用 WECHAT_STORE_PATH 覆盖
 * （默认落在进程工作目录，服务器上即 standalone 目录，站主可写）。
 */

export type ThreadMessage = { dir: 'in' | 'out'; text: string; ts: number };
export type Thread = {
  id: string;
  messages: ThreadMessage[];
  /** 站主写好、等访客下次发消息时带走的回复 */
  queuedReply: string | null;
};

const storePath = () =>
  process.env.WECHAT_STORE_PATH ??
  path.resolve(process.cwd(), 'wechat-inbox.json');

let cache: Record<string, Thread> | null = null;

function load(): Record<string, Thread> {
  if (cache) return cache;
  try {
    cache = JSON.parse(readFileSync(storePath(), 'utf8')) as Record<string, Thread>;
  } catch {
    cache = {};
  }
  return cache;
}

function save() {
  try {
    writeFileSync(storePath(), JSON.stringify(cache), 'utf8');
  } catch {
    /* 写盘失败不致命：内存态仍在，重启最多丢最近几条 */
  }
}

export function appendMessage(id: string, dir: 'in' | 'out', text: string): void {
  const db = load();
  const thread = db[id] ?? { id, messages: [], queuedReply: null };
  thread.messages.push({ dir, text: text.slice(0, 500), ts: Date.now() });
  if (thread.messages.length > 50) thread.messages = thread.messages.slice(-50);
  db[id] = thread;
  save();
}

export function queueReply(id: string, reply: string): void {
  const db = load();
  const thread = db[id] ?? { id, messages: [], queuedReply: null };
  thread.queuedReply = reply.slice(0, 500);
  db[id] = thread;
  save();
}

/** 队列是「取走即清」：一条回复只送达一次。 */
export function takeQueuedReply(id: string): string | null {
  const db = load();
  const reply = db[id]?.queuedReply ?? null;
  if (reply !== null) {
    db[id].queuedReply = null;
    save();
  }
  return reply;
}

export function listThreads(): Thread[] {
  return Object.values(load()).sort(
    (a, b) =>
      (b.messages.at(-1)?.ts ?? 0) - (a.messages.at(-1)?.ts ?? 0),
  );
}

export function hasStore(): boolean {
  return existsSync(storePath());
}
