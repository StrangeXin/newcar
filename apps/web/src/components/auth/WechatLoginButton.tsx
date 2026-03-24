'use client';

export function WechatLoginButton() {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      className="w-full rounded-xl border border-dashed border-emerald-700/35 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900/70"
      title="微信 OAuth 需要小程序环境"
    >
      微信登录（暂不支持）
    </button>
  );
}
