'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 'var(--space-4)',
            padding: 'var(--space-8)',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--color-text, #111)',
            }}
          >
            应用出错了
          </h1>
          <p
            style={{
              color: 'var(--color-text-secondary, #666)',
              maxWidth: '400px',
            }}
          >
            应用遇到了严重错误，请刷新页面重试。
          </p>
          {process.env.NODE_ENV === 'development' && error?.message && (
            <pre
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary, #666)',
                background: 'rgba(0,0,0,0.05)',
                padding: 'var(--space-3, 12px)',
                borderRadius: 'var(--radius-md, 6px)',
                maxWidth: '600px',
                overflowX: 'auto',
                textAlign: 'left',
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              padding: 'var(--space-2, 8px) var(--space-5, 20px)',
              background: 'var(--color-primary, #2563eb)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md, 6px)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  )
}
