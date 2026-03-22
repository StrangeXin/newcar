'use client';

export function WechatLoginButton() {
  return (
    <button
      type="button"
      disabled
      className="w-full rounded-xl border border-dashed border-pine/40 bg-pine/5 px-4 py-3 text-sm font-semibold text-pine/70"
      title="微信 OAuth 需要小程序环境"
    >
      微信登录（暂不支持）
    </button>
  );
}
