import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { currentSolarTerm } from '../lib/solar-terms.ts';

describe('currentSolarTerm', () => {
  it('节气当天即切换（2026-10-08 寒露）', () => {
    assert.equal(currentSolarTerm(new Date(2026, 9, 8)).name, '寒露');
  });

  it('边界前一天仍是上一个节气', () => {
    assert.equal(currentSolarTerm(new Date(2026, 9, 7)).name, '秋分');
    assert.equal(currentSolarTerm(new Date(2026, 0, 4)).name, '冬至'); // 1/4 在小寒前
  });

  it('年初未到小寒，落在去年冬至', () => {
    assert.equal(currentSolarTerm(new Date(2026, 0, 1)).name, '冬至');
  });

  it('年末大雪之后是冬至', () => {
    assert.equal(currentSolarTerm(new Date(2026, 11, 25)).name, '冬至');
  });

  it('同一节气区间内任一天都稳定', () => {
    for (const day of [9, 15, 22]) {
      assert.equal(currentSolarTerm(new Date(2026, 9, day)).name, '寒露');
    }
  });

  it('附带的时令注非空', () => {
    const { name, gloss } = currentSolarTerm(new Date(2026, 5, 21));
    assert.equal(name, '夏至');
    assert.ok(gloss.length > 0);
  });
});
