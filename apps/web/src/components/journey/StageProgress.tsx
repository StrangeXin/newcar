interface StageProgressProps {
  currentStage?: string;
}

const STAGES = [
  { key: 'AWARENESS', label: '需求确认' },
  { key: 'CONSIDERATION', label: '候选筛选' },
  { key: 'COMPARISON', label: '深度对比' },
  { key: 'DECISION', label: '决策强化' },
  { key: 'PURCHASE', label: '购买执行' },
];

export function StageProgress({ currentStage = 'AWARENESS' }: StageProgressProps) {
  const currentIndex = STAGES.findIndex((s) => s.key === currentStage);

  return (
    <aside className="h-full rounded-2xl border border-black/10 bg-white/85 p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ember">Journey Stage</p>
      <h2 className="mt-2 text-lg font-bold">旅程进度</h2>
      <ol className="mt-5 space-y-3">
        {STAGES.map((stage, index) => {
          const completed = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={stage.key}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                active
                  ? 'border-ink bg-ink text-white'
                  : completed
                    ? 'border-pine/25 bg-pine/10 text-pine'
                    : 'border-black/10 bg-white text-black/70'
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  active ? 'bg-white/25 text-white' : 'bg-black/10 text-black/65'
                }`}
              >
                {completed ? '✓' : index + 1}
              </span>
              {stage.label}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        className="mt-6 w-full rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-semibold text-black/80"
      >
        发布历程
      </button>
    </aside>
  );
}
