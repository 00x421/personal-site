import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import process from 'node:process';
import { before, describe, it } from 'node:test';
import {
  appendMessage,
  listThreads,
  queueReply,
  takeQueuedReply,
} from '../lib/wechat-store.ts';

// 每个测试文件是独立进程：把仓库指到临时目录，别碰真实数据
before(() => {
  process.env.WECHAT_STORE_PATH = join(tmpdir(), `wechat-store-test-${process.pid}.json`);
});

describe('wechat-store', () => {
  it('appendMessage 建线程并记录方向', () => {
    appendMessage('oA', 'in', '你好');
    const [thread] = listThreads();
    assert.equal(thread.id, 'oA');
    assert.equal(thread.messages.length, 1);
    assert.equal(thread.messages[0].dir, 'in');
    assert.equal(thread.queuedReply, null);
  });

  it('queueReply → takeQueuedReply 取走即清，再取为 null', () => {
    queueReply('oB', '你的问题我看到啦');
    assert.equal(takeQueuedReply('oB'), '你的问题我看到啦');
    assert.equal(takeQueuedReply('oB'), null);
  });

  it('listThreads 按最新消息时间倒序', () => {
    appendMessage('oOld', 'in', '早');
    appendMessage('oNew', 'in', '晚');
    const ids = listThreads().map((t) => t.id);
    assert.equal(ids[0], 'oNew');
  });

  it('同一毫秒内连发两条，最新一条仍排在前面', () => {
    // 冻结时钟制造同一个毫秒：时间戳必须自行递增，否则排序退化成插入顺序
    const realNow = Date.now;
    Date.now = () => 1_800_000_000_000;
    try {
      appendMessage('oTieA', 'in', '先');
      appendMessage('oTieB', 'in', '后');
    } finally {
      Date.now = realNow;
    }
    const ids = listThreads().map((t) => t.id);
    assert.ok(
      ids.indexOf('oTieB') < ids.indexOf('oTieA'),
      `后发的应排在前面，实际顺序：${ids.join(' → ')}`,
    );
  });

  it('留言超长截断到 500 字', () => {
    appendMessage('oC', 'in', '长'.repeat(800));
    const thread = listThreads().find((t) => t.id === 'oC');
    assert.equal(thread?.messages[0].text.length, 500);
  });
});
