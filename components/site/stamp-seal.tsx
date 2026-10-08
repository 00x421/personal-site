'use client';

/**
 * 单枚朱砂印章。
 *
 * 字体：LXGW WenKai Medium 子集（public/fonts/seal.woff2，仅 6 字，
 * pyftsubset 生成）——印章用楷书是日常认印的正统；GOLIA 印章研究明确
 * 警告「印刷体（宋体）入印等于穿西装去寺庙」。
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
  /** 章面边长（px）——闲章 76、已读 64，尺寸差保留「主次章」的传统比例感 */
  size?: number;
}) {
  return (
    <span
      className={`stamp-seal${muted ? ' is-muted' : ''}${entering ? ' is-entering' : ''}`}
      style={{ '--seal-size': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label={ariaLabel}
    >
      <span className="stamp-seal-text">{text}</span>
    </span>
  );
}
