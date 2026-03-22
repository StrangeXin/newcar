'use client';

import { Kanban } from '@/components/journey/Kanban';
import { useJourney } from '@/hooks/useJourney';

export default function JourneyPage() {
  const { journey, isLoading, error } = useJourney();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-4 lg:max-w-none lg:px-0 lg:py-0">
      <div className="h-full rounded-2xl border border-black/10 bg-white/85 p-6 shadow-card">
        <h1 className="text-xl font-bold">旅程看板</h1>
        {isLoading ? <p className="mt-3 text-sm text-black/60">正在加载旅程数据...</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error.message}</p> : null}
        {!isLoading && !journey && !error ? (
          <p className="mt-3 text-sm text-black/65">暂未找到活跃旅程。</p>
        ) : null}
        {journey ? (
          <div className="mt-4">
            <Kanban journeyId={journey.id} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
