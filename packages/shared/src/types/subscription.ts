export enum SubscriptionPlanName {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionSource {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  PAYMENT = 'PAYMENT',
}

export enum AiRequestType {
  CHAT = 'CHAT',
  TOOL_CALL = 'TOOL_CALL',
  SNAPSHOT = 'SNAPSHOT',
}

export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  displayName: string;
  price: number;
  billingCycle: string;
  monthlyConversationLimit: number;
  monthlyReportLimit: number;
  monthlyTokenLimit: number;
  features: Record<string, boolean>;
  modelAccess: string[];
  sortOrder: number;
}

export interface UserSubscriptionInfo {
  id: string;
  plan: SubscriptionPlanInfo;
  status: string;
  startedAt: string;
  expiresAt: string | null;
  monthlyConversationsUsed: number;
  monthlyReportsUsed: number;
  monthlyTokensUsed: number;
  monthlyResetAt: string;
}

export interface QuotaStatus {
  conversations: { used: number; limit: number; remaining: number };
  reports: { used: number; limit: number; remaining: number };
  tokens: { used: number; limit: number; remaining: number };
}
