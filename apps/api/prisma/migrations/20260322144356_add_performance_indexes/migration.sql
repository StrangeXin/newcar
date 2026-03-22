CREATE INDEX IF NOT EXISTS "journeys_userId_status_idx" ON "journeys"("userId", "status");
CREATE INDEX IF NOT EXISTS "journeys_status_lastActivityAt_idx" ON "journeys"("status", "lastActivityAt");

CREATE INDEX IF NOT EXISTS "published_journeys_contentStatus_visibility_publishedAt_idx"
  ON "published_journeys"("contentStatus", "visibility", "publishedAt");
CREATE INDEX IF NOT EXISTS "published_journeys_contentStatus_visibility_forkCount_likeCount_idx"
  ON "published_journeys"("contentStatus", "visibility", "forkCount", "likeCount");

CREATE INDEX IF NOT EXISTS "notification_feeds_userId_isRead_createdAt_idx"
  ON "notification_feeds"("userId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "notification_feeds_journeyId_createdAt_idx"
  ON "notification_feeds"("journeyId", "createdAt");

CREATE INDEX IF NOT EXISTS "journey_snapshots_journeyId_generatedAt_idx"
  ON "journey_snapshots"("journeyId", "generatedAt");
CREATE INDEX IF NOT EXISTS "car_candidates_journeyId_status_idx"
  ON "car_candidates"("journeyId", "status");
CREATE INDEX IF NOT EXISTS "behavior_events_journeyId_timestamp_idx"
  ON "behavior_events"("journeyId", "timestamp");
