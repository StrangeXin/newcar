ALTER TABLE "car_candidates"
  ADD COLUMN IF NOT EXISTS "matchTags" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "recommendReason" TEXT,
  ADD COLUMN IF NOT EXISTS "relevantDimensions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "candidateRankScore" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "timeline_events" (
  "id" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "timeline_events_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "timeline_events_journeyId_createdAt_idx"
  ON "timeline_events"("journeyId", "createdAt");
