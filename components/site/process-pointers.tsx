'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 工序指针：案例页 hero 上飘过的几枚「笔尖」，各自挂一个制图样式的标签。
 *
 * 借的是多人协作光标的语法（笔尖 + 名字牌），但标签写的是**这道活用了什么**
 * （内容 / 组件 / 部署），而不是谁在场。参考的是 delineate 的「hands」做法，
 * 这里刻意只做三件事，且都按本站语汇收窄：
 *
 * 1. **不跟随鼠标**：位置是写死的百分比，只在进入视口时各就各位。
 *    跟随鼠标它会从「注释」变成「玩具」，还会和卡牌的拖拽、划词即问打架。
 * 2. **不拦事件**：整层 `pointer-events: none` + `aria-hidden`，
 *    它只是画在页面上的笔迹，不参与可访问性树，也不吃点击与选字。
 * 3. **笔尖而不是系统光标**：手绘笔锋路径 + 极轻投影，和纸墨语汇同源。
 */

export type ProcessHand = {
  /** 标签文字，渲染成 `<label>-0N` */
  label: string;
  /** 取站点的语义色：朱红 / 紫罗兰 / 墨 */
  tone: 'seal' | 'violet' | 'ink';
  /** 就位后的位置，相对舞台的百分比 */
  x: number;
  y: number;
  /** 入场位移（px）：笔尖从哪儿飘进来，营造「手刚挪到这里」的错觉 */
  dx: number;
  dy: number;
  /** 笔尖自身的倾斜角 */
  rotate: number;
};

const PEN_PATH =
  'M0 0C3.2 8.2 6 14.4 11 22.4C7.2 19.4 4 18.2 0 17.8C-4 18.2-7.2 19.4-11 22.4C-6 14.4-3.2 8.2 0 0Z';

export function ProcessPointers({ hands }: { hands: readonly ProcessHand[] }) {
  const stageRef = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setArmed(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  if (hands.length === 0) return null;

  return (
    <span className="hand-stage" ref={stageRef} data-armed={armed || undefined} aria-hidden="true">
      {hands.map((hand, index) => (
        <span
          key={hand.label}
          className={`hand hand--${hand.tone}`}
          style={{
            left: `${hand.x}%`,
            top: `${hand.y}%`,
            // 逐枚错开：先到位的先亮牌，读起来像依次落笔
            ['--hand-delay' as string]: `${index * 140}ms`,
            ['--hand-dx' as string]: `${hand.dx}px`,
            ['--hand-dy' as string]: `${hand.dy}px`,
            ['--hand-rotate' as string]: `${hand.rotate}deg`,
          }}
        >
          <svg className="hand-glyph" viewBox="-14 -4 28 30" width="28" height="30">
            <path d={PEN_PATH} />
          </svg>
          <span className="hand-tag">
            {hand.label}-0{index + 1}
          </span>
        </span>
      ))}
    </span>
  );
}
