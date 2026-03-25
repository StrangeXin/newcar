// ── Enums ──────────────────────────────────────────────

export type JourneyStage = 'AWARENESS' | 'CONSIDERATION' | 'COMPARISON' | 'DECISION' | 'PURCHASE';

export type JourneyStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export type CandidateStatus = 'ACTIVE' | 'ELIMINATED' | 'WINNER';

export type FuelType = 'BEV' | 'PHEV' | 'HEV' | 'ICE' | 'EREV';

export type PublishFormat = 'story' | 'report' | 'template';

export type Visibility = 'PUBLIC' | 'UNLISTED';

export type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type NotificationType =
  | 'AI_INSIGHT' | 'PRICE_CHANGE' | 'STAGE_CHANGE'
  | 'PRICE_DROP' | 'NEW_VARIANT' | 'NEW_REVIEW'
  | 'POLICY_UPDATE' | 'OTA_RECALL';

// ── Structured sub-types ───────────────────────────────

export interface JourneyRequirements {
  budget?: { min: number; max: number };
  budgetMin?: number;
  budgetMax?: number;
  fuelType?: string;
  fuelTypePreference?: string[];
  bodyType?: string;
  seats?: number;
  useCases?: string[];
  priorities?: string[];
}

export interface CarBaseSpecs {
  range?: number;
  acceleration?: number;
  length?: number;
  [key: string]: number | undefined;
}

export interface CommunityTags {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypes?: string[];
  [key: string]: unknown;
}

// ── Domain entities ────────────────────────────────────

export interface Journey {
  id: string;
  userId?: string;
  title: string;
  stage: JourneyStage;
  status: JourneyStatus;
  requirements?: JourneyRequirements;
  aiConfidenceScore?: number | null;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  metadata?: Record<string, unknown>;
  relatedCarId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SnapshotInsight {
  insight: string;
  evidence: string;
  confidence: number;
}

export interface JourneySnapshot {
  id: string;
  journeyId: string;
  narrativeSummary?: string | null;
  keyInsights?: SnapshotInsight[] | null;
  nextSuggestedActions?: string[] | null;
  generatedAt: string;
}

export interface CarInfo {
  id: string;
  brand: string;
  model: string;
  variant: string;
  type: string;
  fuelType: FuelType | string;
  baseSpecs?: CarBaseSpecs | null;
  msrp?: number | null;
}

export interface Candidate {
  id: string;
  journeyId: string;
  carId: string;
  status: CandidateStatus;
  aiMatchScore?: number | null;
  userInterestScore?: number | null;
  priceAtAdd?: number | null;
  userNotes?: string | null;
  eliminationReason?: string | null;
  matchTags?: string[];
  recommendReason?: string | null;
  relevantDimensions?: string[];
  candidateRankScore?: number | null;
  car: CarInfo;
}

export type TimelineEventType =
  | 'CANDIDATE_ADDED'
  | 'CANDIDATE_ELIMINATED'
  | 'CANDIDATE_WINNER'
  | 'STAGE_CHANGED'
  | 'REQUIREMENT_UPDATED'
  | 'AI_INSIGHT'
  | 'PRICE_CHANGE'
  | 'USER_ACTION'
  | 'PUBLISH_SUGGESTION'
  | 'JOURNEY_PUBLISHED';

export interface TimelineEvent {
  id: string;
  journeyId: string;
  type: TimelineEventType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CommunityJourney {
  id: string;
  journeyId: string;
  title: string;
  description?: string | null;
  publishedFormats: PublishFormat[];
  tags?: CommunityTags | null;
  storyContent?: string | null;
  reportData?: Record<string, unknown>;
  templateData?: Record<string, unknown>;
  visibility: Visibility;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  forkCount: number;
  contentStatus: ContentStatus;
  publishedAt: string;
  user?: {
    id: string;
    nickname?: string | null;
    avatar?: string | null;
  };
  journey?: {
    id: string;
    status: JourneyStatus;
    stage: JourneyStage;
    requirements?: JourneyRequirements;
    startedAt?: string;
    completedAt?: string | null;
  };
}
