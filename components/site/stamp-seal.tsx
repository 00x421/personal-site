'use client';

/**
 * 单枚朱砂印章。
 *
 * 字体：LXGW WenKai Medium 子集（public/fonts/seal.woff2，闲章池 +
 * 「已读」，pyftsubset 生成）——印章用楷书是日常认印的正统；GOLIA 印章
 * 研究明确警告「印刷体（宋体）入印等于穿西装去寺庙」。
 * 刀感：SVG feTurbulence 斑驳遮罩模拟印泥不匀（data-uri，无外部请求）。
 * 动画：三阶段盖章（悬浮→砸落→弹性回正），prefers-reduced-motion 时
 * 直接呈现；支持触觉反馈的设备伴随 18ms 微震。
 */

export function StampSeal({
  text,
  ariaLabel,
  muted = false,
  entering = false,
  size = 64,
}: {
  text: string;
  ariaLabel: string;
  /** 淡印：历史阅读记录的旧印痕 */
  muted?: boolean;
  /** 首次盖下的动画入场（重渲染不再重播） */
  entering?: boolean;
  /** 章面边长（px） */
  size?: number;
}) {
  // 竖排单列不折行：字数越多字号越小（4 字印 12px / 2 字印 17px）
  const fontSize = Math.min(17, Math.floor(48 / text.length));
  /* 印章是「文字 + 印泥纹理」渲染出来的方寸图形，没有位图可以交给 <img>；
     role="img" 让读屏把它当作一枚图章整体朗读，而不是逐字念章面。
     这条 a11y 规则在此不适用，按元素范围关闭。 */
  /* oxlint-disable jsx-a11y/prefer-tag-over-role */
  return (
    <span
      className={`stamp-seal${muted ? ' is-muted' : ''}${entering ? ' is-entering' : ''}`}
      style={{ '--seal-size': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={ariaLabel}
    >
      <span className="stamp-seal-text" style={{ fontSize: `${fontSize}px` }}>
        {text}
      </span>
    </span>
  );
}
