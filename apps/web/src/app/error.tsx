'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: 'var(--space-4)',
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        出了点问题
      </h2>
      <p
        style={{
          color: 'var(--color-text-secondary)',
          maxWidth: '400px',
        }}
      >
        页面遇到了一个错误，请尝试刷新。
      </p>
      {process.env.NODE_ENV === 'development' && error?.message && (
        <pre
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            background: 'rgba(0,0,0,0.05)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
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
          padding: 'var(--space-2) var(--space-5)',
          background: 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
        }}
      >
        重试
      </button>
    </div>
  )
}
