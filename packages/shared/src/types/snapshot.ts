export enum SnapshotTrigger {
  DAILY = 'DAILY',
  EVENT_TRIGGERED = 'EVENT_TRIGGERED',
  MANUAL = 'MANUAL',
}

export enum AttentionSignalType {
  PRICE_DROP = 'PRICE_DROP',
  NEW_VARIANT = 'NEW_VARIANT',
  NEW_REVIEW = 'NEW_REVIEW',
  POLICY_UPDATE = 'POLICY_UPDATE',
  OTA_RECALL = 'OTA_RECALL',
}

export interface KeyInsight {
  insight: string;
  evidence: string;
  confidence: number;
}

export interface AttentionSignal {
  carId: string;
  signalType: AttentionSignalType;
  description: string;
  delta?: number;
  oldValue?: string;
  newValue?: string;
}

export interface SnapshotExtractedSignal {
  type: string;
  value: string;
  confidence: number;
}

export interface SnapshotBehaviorEvent {
  type: string;
  timestamp: Date | string;
}

export interface SnapshotCandidateSummary {
  carId: string;
  status: string;
  aiMatchScore?: number | null;
}

export interface SnapshotAiResponse {
  narrative_summary?: string;
  key_insights?: KeyInsight[];
  top_recommendation?: string | null;
  recommendation_reasoning?: string;
  attention_signals?: AttentionSignal[];
  next_suggested_actions?: string[];
  tokens_used?: number;
}

export interface SnapshotInput {
  journeyId: string;
  trigger: SnapshotTrigger;
  recentBehaviorEvents: SnapshotBehaviorEvent[];
  allExtractedSignals: SnapshotExtractedSignal[];
  candidates: SnapshotCandidateSummary[];
  latestSnapshot?: {
    keyInsights?: KeyInsight[];
  };
}
