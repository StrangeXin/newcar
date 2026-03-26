import { JourneyStatus, SnapshotTrigger } from '@newcar/shared';
import { prisma } from '../lib/prisma';
import { snapshotService } from '../services/snapshot.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const SILENCE_THRESHOLD_DAYS = 7;
const BATCH_SIZE = 5;

export async function runDailySnapshotJob(): Promise<void> {
  const cutoffDate = new Date(Date.now() - SILENCE_THRESHOLD_DAYS * DAY_MS);

  const activeJourneys = await prisma.journey.findMany({
    where: {
      status: JourneyStatus.ACTIVE,
      lastActivityAt: { gte: cutoffDate },
    },
    select: { id: true, userId: true },
  });

  console.log(`Daily snapshot job: found ${activeJourneys.length} active journeys`);

  const results: Array<{ journeyId: string; success: boolean; snapshotId?: string; error?: string }> = [];

  // Process journeys in batches, using Promise.allSettled for controlled concurrency
  for (let i = 0; i < activeJourneys.length; i += BATCH_SIZE) {
    const batch = activeJourneys.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (journey) => {
        try {
          const snapshot = await snapshotService.generateSnapshot(journey.id, SnapshotTrigger.DAILY);
          return { journeyId: journey.id, success: snapshot !== null, snapshotId: snapshot?.id };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Snapshot failed for journey ${journey.id}:`, errMsg);
          return { journeyId: journey.id, success: false, error: errMsg };
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({ journeyId: 'unknown', success: false, error: result.reason?.message || 'unknown_error' });
      }
    }
  }

  console.log(`Daily snapshot job completed: ${results.filter((item) => item.success).length}/${results.length} succeeded`);
}
