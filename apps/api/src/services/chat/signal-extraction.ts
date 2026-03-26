/**
 * Signal extraction — buildSignals & estimateConfidenceScore
 *
 * Pure functions (no I/O) that analyse a user message and journey
 * requirements to produce signal metadata and confidence scores.
 */

export interface ExtractedSignal {
  type: string;
  value: string;
  confidence: number;
  updatedAt: string;
}

export function buildSignals(
  message: string,
  requirements: Record<string, unknown>,
): ExtractedSignal[] {
  const signals: ExtractedSignal[] = [];
  const now = new Date().toISOString();

  const rangeMatch = message.match(/(\d+)\s*[-到]\s*(\d+)\s*万/);
  if (rangeMatch) {
    signals.push({
      type: 'REQUIREMENT',
      value: `${rangeMatch[1]}-${rangeMatch[2]}万`,
      confidence: 0.86,
      updatedAt: now,
    });
  }

  const singleBudgetMatch = message.match(/(\d+)\s*万/);
  if (!rangeMatch && singleBudgetMatch) {
    signals.push({
      type: 'REQUIREMENT',
      value: `${singleBudgetMatch[1]}万预算`,
      confidence: 0.72,
      updatedAt: now,
    });
  }

  for (const keyword of ['SUV', '轿车', 'MPV', '纯电', '增程', '混动', '家用', '通勤', '长途']) {
    if (message.includes(keyword)) {
      signals.push({
        type: 'PREFERENCE',
        value: keyword,
        confidence: 0.7,
        updatedAt: now,
      });
    }
  }

  if (signals.length === 0 && Object.keys(requirements).length > 0) {
    signals.push({
      type: 'CONCERN',
      value: '延续现有需求上下文',
      confidence: 0.5,
      updatedAt: now,
    });
  }

  return signals;
}

export function estimateConfidenceScore(
  requirements: Record<string, unknown>,
  response: string,
): number {
  let score = 0.45;
  if (requirements.budgetMin || requirements.budgetMax) score += 0.12;
  if (Array.isArray(requirements.useCases) && requirements.useCases.length > 0) score += 0.12;
  if (Array.isArray(requirements.fuelTypePreference) && requirements.fuelTypePreference.length > 0) score += 0.1;
  if (requirements.stylePreference) score += 0.08;
  if (response.length > 80) score += 0.05;
  return Math.min(0.95, Number(score.toFixed(2)));
}
