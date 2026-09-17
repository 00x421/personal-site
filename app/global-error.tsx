'use client';

/**
 * 根布局自身抛错时的兜底（global-error 会替换整个 <html>/<body>，
 * 此时全局样式未必生效），因此这里不依赖任何 class，全部走内联样式，
 * 并沿用站点的纸墨配色。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          background: '#f4f2ec',
          color: '#17171b',
          fontFamily:
            "'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        }}
      >
        <div style={{ width: '100%', maxWidth: 620, padding: '0 34px' }}>
          <p
            style={{
              margin: 0,
              color: '#6355ce',
              font: '700 11px monospace',
              letterSpacing: '0.12em',
            }}
          >
            FATAL / 站点未能启动
          </p>
          <h1
            style={{
              margin: '20px 0',
              font: '500 44px/1.1 Georgia, serif',
              letterSpacing: '-0.01em',
            }}
          >
            地基出了点问题。
          </h1>
          <p
            style={{
              margin: '0 0 30px',
              color: '#4e4d49',
              fontSize: 15,
              lineHeight: 1.85,
            }}
          >
            这是比页面错误更底层的故障，通常与部署或运行时环境有关。
            <br />
            先重试一次；若持续出现，错误摘要：
            <span style={{ color: '#6355ce', font: '12px monospace' }}>
              {error.digest ?? error.message}
            </span>
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 44,
              padding: '0 22px',
              border: 0,
              background: '#17171b',
              color: '#f4f2ec',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
