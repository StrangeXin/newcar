export interface CompletenessResult {
  stage: string;
  score: number; // 0-100
  missingItems: string[]; // 中文描述的缺失项列表
  suggestions: string[]; // 给 AI 的引导建议
}
