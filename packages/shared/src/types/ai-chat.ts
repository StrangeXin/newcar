export enum ToolName {
  SEARCH_CAR = 'search_car',
  ADD_CANDIDATE = 'add_candidate',
  COMPARE_CARS = 'compare_cars',
  GET_CAR_DETAIL = 'get_car_detail',
  GET_PRICE = 'get_price',
  RECORD_DECISION = 'record_decision',
}

export interface AiChatRequest {
  journeyId: string;
  message: string;
  conversationId?: string;
  context?: {
    recentEvents?: any[];
    extractedSignals?: any[];
    candidates?: any[];
  };
}

export interface AiChatResponse {
  message: string;
  conversationId: string;
  extractedSignals?: any[];
  toolCalls?: {
    name: ToolName;
    args: Record<string, unknown>;
    result?: unknown;
  }[];
}
