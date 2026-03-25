'use client';

export function WechatLoginButton() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className="w-full rounded-xl border border-dashed border-[var(--success-text)]/35 bg-[var(--success-muted)] px-4 py-3 text-sm font-semibold text-[var(--success-text)]/70"
      title="微信 OAuth 需要小程序环境"
    >
      微信登录（暂不支持）
    </button>
  );
}
