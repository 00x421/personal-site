import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bowedPoint,
  countUpAt,
  detourPoint,
  dwellMs,
  easeGrow,
  edgePoint,
  frameSizeAt,
  gauss,
  handCountFor,
  handTravelMs,
  measureDurationMs,
  textOffsetAt,
  typingSchedule,
} from '../lib/reveal-motion.ts';

/** 可复现的伪随机数（线性同余），让概率相关的断言稳定。 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** 取最后一拍（空数组时给出兜底，避免测试里到处判空）。 */
function last<T>(items: readonly T[]): T {
  return items[items.length - 1];
}

describe('handTravelMs', () => {
  it('距离越远越久，但是对数增长（远十倍不到两倍）', () => {
    const near = handTravelMs(50, 24, 0.52);
    const mid = handTravelMs(500, 24, 0.52);
    const far = handTravelMs(5000, 24, 0.52);
    assert.ok(near < mid && mid < far);
    assert.ok(far < mid * 2, `远十倍不该到两倍，实际 ${far / mid}`);
  });

  it('系数就是全局快慢', () => {
    assert.ok(Math.abs(handTravelMs(300, 24, 0.5) * 2 - handTravelMs(300, 24, 1)) < 1e-9);
  });

  it('基准小于 6 时按 6 算，避免除零炸开', () => {
    assert.ok(Number.isFinite(handTravelMs(10, 0, 0.52)));
  });
});

describe('gauss / dwellMs', () => {
  it('高斯的均值接近 0，标准差接近 1', () => {
    const rng = seeded(7);
    const samples = Array.from({ length: 4000 }, () => gauss(rng));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    assert.ok(Math.abs(mean) < 0.1, `均值偏了：${mean}`);
    assert.ok(Math.abs(Math.sqrt(variance) - 1) < 0.1, `标准差偏了：${Math.sqrt(variance)}`);
  });

  it('停顿围绕 95ms 波动，但始终是正数', () => {
    const rng = seeded(11);
    const values = Array.from({ length: 500 }, () => dwellMs(rng));
    assert.ok(values.every((v) => v > 0));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    assert.ok(mean > 80 && mean < 115, `停顿均值 ${mean}`);
  });
});

describe('handCountFor', () => {
  it('桌面约 12 支，手机落到下限 4 支', () => {
    assert.equal(handCountFor(1440 * 900), 12);
    assert.equal(handCountFor(390 * 844), 4);
  });

  it('永远夹在 4–14，超大屏也不无限加', () => {
    assert.equal(handCountFor(0), 4);
    assert.equal(handCountFor(8000 * 5000), 14);
  });
});

describe('edgePoint', () => {
  const viewport = { width: 1000, height: 800 };

  it('从左缘附近出发就走左边出去', () => {
    assert.deepEqual(edgePoint({ x: 30, y: 400 }, viewport), { x: -40, y: 400 });
  });

  it('从右下角附近出发就走下边或右边', () => {
    const point = edgePoint({ x: 990, y: 790 }, viewport);
    assert.ok(point.x > 1000 || point.y > 800 || point.x < 0);
  });
});

describe('detourPoint', () => {
  it('距离太近就不折腾，直接到位', () => {
    assert.equal(detourPoint({ x: 0, y: 0 }, { x: 1, y: 0 }, seeded(3)), null);
  });

  it('远距离会产生一个偏离目标点的落点（先冲过头）', () => {
    const rng = seeded(5);
    let offTarget = 0;
    for (let i = 0; i < 200; i += 1) {
      const point = detourPoint({ x: 0, y: 0 }, { x: 400, y: 0 }, rng);
      if (!point) continue;
      if (Math.hypot(point.x - 400, point.y) > 2) offTarget += 1;
    }
    assert.ok(offTarget > 150, `大多数时候应当偏离目标，实际 ${offTarget}/200`);
  });

  it('偏离量级在合理范围（不会飞到屏幕外）', () => {
    const rng = seeded(9);
    for (let i = 0; i < 100; i += 1) {
      const point = detourPoint({ x: 0, y: 0 }, { x: 300, y: 200 }, rng);
      if (!point) continue;
      assert.ok(Math.hypot(point.x - 300, point.y - 200) < 60);
    }
  });
});

describe('bowedPoint', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 0 };

  it('两端精确落在起点与终点（浮点误差内）', () => {
    const start = bowedPoint(from, to, 0, 0.1);
    const end = bowedPoint(from, to, 1, 0.1);
    assert.ok(Math.abs(start.x) < 1e-9 && Math.abs(start.y) < 1e-9);
    assert.ok(Math.abs(end.x - 100) < 1e-9 && Math.abs(end.y) < 1e-9);
  });

  it('中段被推开成弧线（bow 为 0 时就是直线）', () => {
    const straight = bowedPoint(from, to, 0.5, 0);
    const curved = bowedPoint(from, to, 0.5, 0.1);
    assert.ok(Math.abs(straight.y) < 1e-9);
    assert.ok(Math.abs(curved.y) > 5, `弧线偏移太小：${curved.y}`);
  });
});

describe('typingSchedule', () => {
  const chars = Array.from('指针先到，内容后到。');

  it('时间单调不减，最后写满全部字符', () => {
    const steps = typingSchedule(chars, { allowTypos: false }, seeded(21));
    let previous = -1;
    for (const step of steps) {
      assert.ok(step.t >= previous, '时间回退了');
      previous = step.t;
    }
    assert.equal(last(steps).n, chars.length);
  });

  it('标点之后要停更久（这是「写字」和「滴答」的区别）', () => {
    const rng = seeded(31);
    const schedule = typingSchedule(Array.from('ab，cd'), { allowTypos: false }, rng);
    const deltas = schedule.map((step, i) => step.t - (schedule[i - 1]?.t ?? 0));
    // 「，」是第 2 个字，它之后那个间隔应当明显长于「b」之后的间隔
    assert.ok(deltas[3] > deltas[1], `标点后的间隔 ${deltas[3]} 不大于 ${deltas[1]}`);
  });

  it('整体压缩：中段文本压到 1200ms 附近', () => {
    const steps = typingSchedule(Array.from('字'.repeat(60)), { allowTypos: false }, seeded(41));
    const total = last(steps).t;
    assert.ok(total > 1000 && total < 1400, `60 字压到 ${total}ms，不在 1200 附近`);
  });

  it('压缩有上限（4 倍）：超长文本也不会无限加速到看不清', () => {
    const steps = typingSchedule(Array.from('字'.repeat(400)), { allowTypos: false }, seeded(41));
    const total = last(steps).t;
    // 400 字原始约 20000ms，压缩系数封顶 4 → 约 5000ms
    assert.ok(total > 4000 && total < 6000, `400 字压到 ${total}ms`);
  });

  it('短文本不加速（压缩系数下限为 1）', () => {
    const steps = typingSchedule(Array.from('短'), { allowTypos: false }, seeded(43));
    assert.ok(last(steps).t > 20);
  });

  it('会打错字并退格：中间出现 extra，最后回到空', () => {
    const rng = seeded(1);
    let sawTypo = false;
    for (let attempt = 0; attempt < 40 && !sawTypo; attempt += 1) {
      const steps = typingSchedule(Array.from('这是一句足够长的中文，用来触发一次打错字。'), {}, rng);
      const withExtra = steps.filter((step) => step.extra !== '');
      if (withExtra.length > 0) {
        sawTypo = true;
        assert.ok(withExtra.every((step) => step.extra.length > 0));
        assert.equal(last(steps).extra, '', '最后必须把错字退干净');
      }
    }
    assert.ok(sawTypo, '40 次里一次都没打错，概率模型有问题');
  });

  it('关掉错字开关就没有 extra', () => {
    const steps = typingSchedule(
      Array.from('这是一句足够长的中文，用来触发一次打错字。'),
      { allowTypos: false },
      seeded(2),
    );
    assert.ok(steps.every((step) => step.extra === ''));
  });

  it('占位符（空串）不耗时、不推进字符数', () => {
    const withPlaceholders = ['字', '', '字', ''];
    const steps = typingSchedule(withPlaceholders, { allowTypos: false }, seeded(51));
    assert.deepEqual(
      steps.map((step) => step.n),
      [1, 2, 3, 4],
    );
  });
});

describe('textOffsetAt', () => {
  it('占位符不占文本偏移', () => {
    assert.equal(textOffsetAt(['字', '', '字', ''], 0), 0);
    assert.equal(textOffsetAt(['字', '', '字', ''], 2), 1);
    assert.equal(textOffsetAt(['字', '', '字', ''], 4), 2);
  });

  it('越界被夹住', () => {
    assert.equal(textOffsetAt(['a', 'b'], 99), 2);
    assert.equal(textOffsetAt(['a', 'b'], -5), 0);
  });
});

describe('easeGrow / frameSizeAt / measureDurationMs / countUpAt', () => {
  it('缓动两端精确', () => {
    assert.equal(easeGrow(0), 0);
    assert.equal(easeGrow(1), 1);
    assert.equal(easeGrow(-1), 0);
    assert.equal(easeGrow(2), 1);
  });

  it('选框尺寸首尾与缓动一致', () => {
    const size = { width: 300, height: 120 };
    assert.deepEqual(frameSizeAt(size, 0), { width: 0, height: 0 });
    assert.deepEqual(frameSizeAt(size, 1), size);
    for (let i = 1; i < 10; i += 1) {
      const frame = frameSizeAt(size, i / 10);
      const eased = easeGrow(i / 10);
      assert.ok(Math.abs(frame.width - size.width * eased) <= 0.5);
    }
  });

  it('量框时长夹在 260–700ms', () => {
    assert.equal(measureDurationMs(0, 0), 260);
    assert.equal(measureDurationMs(4000, 3000), 700);
    assert.ok(measureDurationMs(320, 180) > 260);
  });

  it('计数收尾慢，终点精确', () => {
    assert.equal(countUpAt(543, 0), 0);
    assert.equal(countUpAt(543, 1), 543);
    assert.ok(countUpAt(1000, 0.5) > 900);
  });
});
