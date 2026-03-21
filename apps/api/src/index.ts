import { createApp } from './app';
import { config } from './config';
import { runDailySnapshotJob } from './jobs/daily-snapshot.job';
import { scheduler } from './lib/scheduler';

const app = createApp();

scheduler.add('daily-snapshot', '0 8 * * *', runDailySnapshotJob);
scheduler.start();

app.listen(config.port, () => {
  console.log(`API server running on port ${config.port}`);
});
