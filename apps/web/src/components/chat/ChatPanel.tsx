export function ChatPanel() {
  return (
    <aside className="flex h-full flex-col rounded-2xl border border-black/10 bg-white/85 shadow-card">
      <div className="border-b border-black/10 px-4 py-3">
        <h2 className="text-base font-bold">AI 购车助手</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-pine/10 px-3 py-2 text-sm text-pine">
          你好，我可以帮你梳理预算、用途并筛选候选车型。
        </div>
      </div>
      <div className="border-t border-black/10 p-3">
        <div className="rounded-xl border border-black/15 bg-white px-3 py-2 text-sm text-black/45">
          输入你的问题（Task 5 实现）
        </div>
      </div>
    </aside>
  );
}
