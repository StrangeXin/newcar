export enum SnapshotTrigger {
  DAILY = 'DAILY',
  EVENT_TRIGGERED = 'EVENT_TRIGGERED',
  MANUAL = 'MANUAL',
}

export interface KeyInsight {
  insight: string;
  evidence: string;
  confidence: number;
}

export interface AttentionSignal {
  carId: string;
  signalType: 'PRICE_DROP' | 'NEW_VARIANT' | 'NEW_REVIEW' | 'POLICY_UPDATE' | 'OTA_RECALL';
  description: string;
  delta?: number;
  oldValue?: string;
  newValue?: string;
}

export interface SnapshotInput {
  journeyId: string;
  trigger: SnapshotTrigger;
  recentBehaviorEvents: any[];
  allExtractedSignals: any[];
  candidates: any[];
  latestSnapshot?: any;
}
