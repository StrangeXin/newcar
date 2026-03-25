ALTER TABLE "published_journeys"
  ADD COLUMN IF NOT EXISTS "publishSummary" TEXT;
