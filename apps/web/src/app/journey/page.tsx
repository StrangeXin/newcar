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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-4 lg:max-w-none lg:px-0 lg:py-0">
      <div className="h-full rounded-2xl border border-black/10 bg-white/85 p-6 shadow-card">
        <h1 className="text-xl font-bold">旅程看板</h1>
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
