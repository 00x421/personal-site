import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SWARM_MIN_WIDTH, shouldDraw } from '../lib/swarm-gate.ts';
import type { SwarmEnv } from '../lib/swarm-gate.ts';

/** 桌面、首次、非省流量、非触屏：默认该演一场。 */
const desktop: SwarmEnv = {
  reducedMotion: false,
  coarsePointer: false,
  saveData: false,
  seenBefore: false,
  viewportWidth: 1440,
  forced: false,
};

describe('shouldDraw', () => {
  it('桌面首次访问：播', () => {
    assert.equal(shouldDraw(desktop), true);
  });

  it('看过一次之后不再播（老访客不该每次重看）', () => {
    assert.equal(shouldDraw({ ...desktop, seenBefore: true }), false);
  });

  it('减少动效优先于一切：即使 ?draw=1 也不播', () => {
    assert.equal(shouldDraw({ ...desktop, reducedMotion: true }), false);
    assert.equal(
      shouldDraw({ ...desktop, reducedMotion: true, forced: true }),
      false,
    );
  });

  it('触屏与省流量都不播', () => {
    assert.equal(shouldDraw({ ...desktop, coarsePointer: true }), false);
    assert.equal(shouldDraw({ ...desktop, saveData: true }), false);
  });

  it('窄屏不播，刚好到门槛才播', () => {
    assert.equal(
      shouldDraw({ ...desktop, viewportWidth: SWARM_MIN_WIDTH - 1 }),
      false,
    );
    assert.equal(
      shouldDraw({ ...desktop, viewportWidth: SWARM_MIN_WIDTH }),
      true,
    );
  });

  it('?draw=1 可以绕过「已看过」，但绕不过触屏/窄屏的观感判断', () => {
    assert.equal(
      shouldDraw({ ...desktop, seenBefore: true, forced: true }),
      true,
    );
    assert.equal(
      shouldDraw({
        ...desktop,
        seenBefore: true,
        forced: true,
        coarsePointer: true,
      }),
      true,
    );
    assert.equal(
      shouldDraw({
        ...desktop,
        seenBefore: true,
        forced: true,
        viewportWidth: 390,
      }),
      true,
    );
  });
});
