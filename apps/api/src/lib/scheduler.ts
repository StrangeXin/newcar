type Job = () => Promise<void>;

interface ScheduledJob {
  name: string;
  cron: string;
  lastRun?: Date;
  job: Job;
}

export class Scheduler {
  private jobs: ScheduledJob[] = [];
  private intervalId?: NodeJS.Timeout;

  add(name: string, cron: string, job: Job) {
    this.jobs.push({ name, cron, job });
  }

  start() {
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 60 * 1000);
    console.log('Scheduler started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private async tick() {
    const now = new Date();

    for (const scheduledJob of this.jobs) {
      if (!this.shouldRun(scheduledJob, now)) {
        continue;
      }

      console.log(`Running job: ${scheduledJob.name}`);
      try {
        await scheduledJob.job();
        scheduledJob.lastRun = now;
      } catch (err) {
        console.error(`Job ${scheduledJob.name} failed:`, err);
      }
    }
  }

  private shouldRun(job: ScheduledJob, now: Date): boolean {
    const parts = job.cron.split(' ');
    if (parts.length < 2) {
      return false;
    }

    const minute = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);

    if (Number.isNaN(minute) || Number.isNaN(hour)) {
      return false;
    }
    if (now.getMinutes() !== minute) {
      return false;
    }
    if (now.getHours() !== hour) {
      return false;
    }

    if (job.lastRun && now.getTime() - job.lastRun.getTime() < 60 * 60 * 1000) {
      return false;
    }

    return true;
  }
}

export const scheduler = new Scheduler();
