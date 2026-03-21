export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

export enum SignalType {
  REQUIREMENT = 'REQUIREMENT',
  PREFERENCE = 'PREFERENCE',
  CONCERN = 'CONCERN',
  TRADEOFF = 'TRADEOFF',
  REJECTION = 'REJECTION',
}

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface ExtractedSignal {
  type: SignalType;
  value: string;
  confidence: number; // 0-1
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}
