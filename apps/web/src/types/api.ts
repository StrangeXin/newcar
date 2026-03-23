export interface Journey {
  id: string;
  userId?: string;
  title: string;
  stage: string;
  status: string;
  requirements?: Record<string, unknown>;
  aiConfidenceScore?: number | null;
}

export interface NotificationItem {
  id: string;
  type: string;
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
  fuelType: string;
  baseSpecs?: Record<string, unknown> | null;
  msrp?: number | null;
}

export interface Candidate {
  id: string;
  journeyId: string;
  carId: string;
  status: 'ACTIVE' | 'ELIMINATED' | 'WINNER';
  aiMatchScore?: number | null;
  userInterestScore?: number | null;
  priceAtAdd?: number | null;
  userNotes?: string | null;
  eliminationReason?: string | null;
  car: CarInfo;
}

export interface CommunityJourney {
  id: string;
  journeyId: string;
  title: string;
  description?: string | null;
  publishedFormats: string[];
  tags?: Record<string, unknown> | null;
  storyContent?: string | null;
  reportData?: unknown;
  templateData?: unknown;
  visibility: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  forkCount: number;
  contentStatus: string;
  publishedAt: string;
  user?: {
    id: string;
    nickname?: string | null;
    avatar?: string | null;
  };
  journey?: {
    id: string;
    status: string;
    stage: string;
    requirements?: Record<string, unknown>;
    startedAt?: string;
    completedAt?: string | null;
  };
}
