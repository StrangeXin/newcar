'use client';

import { useEffect } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
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
        <div className="inline-flex items-center gap-1.5 rounded-ws-lg border border-slate-200 bg-white/90 p-ws14 text-[11px] text-slate-500 shadow-workspace">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-orange-600" aria-hidden="true" />
          正在加载旅程数据...
        </div>
      ) : null}
      {error ? (
        <div className="inline-flex items-center gap-1.5 rounded-ws-lg border border-red-200 bg-red-50 p-ws14 text-[11px] text-red-700 shadow-workspace">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {error.message}
        </div>
      ) : null}
      {!isLoading && !journey && !error ? <NewJourneyWizard onCreated={refresh} /> : null}
      {journey && !error ? <Kanban journeyId={journey.id} /> : null}
    </main>
  );
}
