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
    <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {isLoading ? (
        <div className="rounded-ws-lg border border-workspace-border bg-workspace-surface p-ws14 text-[11px] text-black/60 shadow-workspace">
          正在加载旅程数据...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-ws-lg border border-red-200 bg-workspace-surface p-ws14 text-[11px] text-red-600 shadow-workspace">
          {error.message}
        </div>
      ) : null}
      {!isLoading && !journey && !error ? <NewJourneyWizard onCreated={refresh} /> : null}
      {journey && !error ? <Kanban journeyId={journey.id} /> : null}
    </main>
  );
}
