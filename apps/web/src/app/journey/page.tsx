'use client';

import { useEffect } from 'react';
import { Kanban } from '@/components/journey/Kanban';
import { NewJourneyWizard } from '@/components/journey/NewJourneyWizard';
import { useJourney } from '@/hooks/useJourney';
import { trackEvent } from '@/lib/behavior';

export default function JourneyPage() {
  const { journey, isLoading, error, refresh } = useJourney();

  useEffect(() => {
    if (!journey?.id) {
      return;
    }
    void trackEvent(journey.id, 'PAGE_VIEW', 'PAGE', 'journey', { page: 'journey' });
  }, [journey?.id]);

  return (
    <main className="min-w-0">
      <div className="rounded-[20px] border border-black/10 bg-white/75 p-4 shadow-card backdrop-blur md:rounded-2xl md:p-5 xl:bg-white/85">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e85d26]">Workspace</p>
            <h1 className="mt-1 text-xl font-bold text-[#111]">旅程工作台</h1>
          </div>
          {journey ? (
            <span className="rounded-full border border-black/10 bg-[#f3f4f6] px-3 py-1 text-xs font-semibold text-black/55">
              {journey.title}
            </span>
          ) : null}
        </div>
        {isLoading ? <p className="mt-3 text-sm text-black/60">正在加载旅程数据...</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error.message}</p> : null}
        {!isLoading && !journey && !error ? <div className="mt-4"><NewJourneyWizard onCreated={refresh} /></div> : null}
        {journey && !error ? (
          <div className="mt-4">
            <Kanban journeyId={journey.id} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
