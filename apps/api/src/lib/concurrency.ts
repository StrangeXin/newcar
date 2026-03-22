/**
 * Concurrency control utilities for AI snapshot generation.
 *
 * Memory-based Semaphore for single-process scenarios.
 * For multi-instance deployments, replace with Redis-based counter
 * (see comments in Semaphore class).
 */

export class Semaphore {
  private permits: number;
  private readonly maxConcurrent: number;
  private waitQueue: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    this.permits = maxConcurrent;
    this.maxConcurrent = maxConcurrent;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return Promise.resolve();
    }

    // Wait for a permit to become available
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      // Fulfill the longest-waiting request
      const resolve = this.waitQueue.shift()!;
      resolve();
    } else {
      this.permits++;
    }
  }

  get availablePermits(): number {
    return this.permits;
  }
}

const SNAPSHOT_CONCURRENCY = parseInt(process.env.SNAPSHOT_CONCURRENCY || '5', 10);

/** Global semaphore for limiting concurrent AI snapshot generation */
export const snapshotSemaphore = new Semaphore(SNAPSHOT_CONCURRENCY);
