import type { CompletenessResult } from '@newcar/shared';

interface JourneyInput {
  id: string;
  stage: string;
  requirements: Record<string, unknown>;
}

interface CandidateInput {
  id: string;
  status: string;
  userNotes?: string | null;
  car: { id: string; brand: string; model: string };
}

interface SignalInput {
  type: string;
  value: string;
  confidence: number;
}

interface SnapshotInput {
  id: string;
}

export function calculateCompleteness(
  journey: JourneyInput,
  candidates: CandidateInput[],
  signals: SignalInput[],
  snapshots: SnapshotInput[],
): CompletenessResult {
  const req = journey.requirements || {};
  const stage = journey.stage;

  switch (stage) {
    case 'AWARENESS':
      return calcAwareness(req);
    case 'CONSIDERATION':
      return calcConsideration(req, candidates, signals);
    case 'COMPARISON':
      return calcComparison(candidates, signals, snapshots);
    case 'DECISION':
      return calcDecision(candidates);
    case 'PURCHASE':
      return calcPurchase(candidates, signals, snapshots);
    default:
      return { stage, score: 0, missingItems: [], suggestions: [] };
  }
}

function calcAwareness(req: Record<string, unknown>): CompletenessResult {
  const items: { label: string; met: boolean }[] = [
    { label: '预算范围已明确', met: Boolean(req.budgetMin && req.budgetMax) },
    { label: '用途已明确', met: isNonEmptyArray(req.useCases) },
    { label: '燃料偏好已明确', met: isNonEmptyArray(req.fuelTypePreference) },
    { label: '车型偏好已明确', met: Boolean(req.stylePreference) },
  ];

  return buildResult('AWARENESS', items, 25);
}

function calcConsideration(
  req: Record<string, unknown>,
  candidates: CandidateInput[],
  signals: SignalInput[],
): CompletenessResult {
  const awarenessComplete =
    Boolean(req.budgetMin && req.budgetMax) &&
    isNonEmptyArray(req.useCases) &&
    isNonEmptyArray(req.fuelTypePreference) &&
    Boolean(req.stylePreference);

  const items: { label: string; met: boolean }[] = [
    { label: 'AWARENESS 维度完成', met: awarenessComplete },
    { label: '至少 1 个候选车', met: candidates.filter((c) => c.status !== 'ELIMINATED').length >= 1 },
    { label: '至少浏览过 2 款车', met: candidates.length >= 2 },
    { label: '有提取到的偏好信号', met: signals.length > 0 },
  ];

  return buildResult('CONSIDERATION', items, [20, 30, 25, 25]);
}

function calcComparison(
  candidates: CandidateInput[],
  signals: SignalInput[],
  snapshots: SnapshotInput[],
): CompletenessResult {
  const activeCandidates = candidates.filter((c) => c.status === 'ACTIVE');
  const eliminatedCandidates = candidates.filter((c) => c.status === 'ELIMINATED');
  const preferenceSignals = signals.filter((s) => s.type === 'PREFERENCE');

  const items: { label: string; met: boolean }[] = [
    { label: '至少 2 个 ACTIVE 候选车', met: activeCandidates.length >= 2 },
    { label: '有候选车被淘汰', met: eliminatedCandidates.length > 0 },
    { label: 'AI 生成过快照分析', met: snapshots.length > 0 },
    { label: '用户表达过倾向', met: preferenceSignals.length > 0 },
  ];

  return buildResult('COMPARISON', items, [30, 25, 25, 20]);
}

function calcDecision(candidates: CandidateInput[]): CompletenessResult {
  const winner = candidates.find((c) => c.status === 'WINNER');

  const items: { label: string; met: boolean }[] = [
    { label: '有 1 个明确的 WINNER', met: Boolean(winner) },
    { label: '选择理由已记录', met: Boolean(winner?.userNotes) },
    { label: '最终预算已确认', met: Boolean(winner) },
  ];

  return buildResult('DECISION', items, [40, 30, 30]);
}

function calcPurchase(
  candidates: CandidateInput[],
  signals: SignalInput[],
  snapshots: SnapshotInput[],
): CompletenessResult {
  const winner = candidates.find((c) => c.status === 'WINNER');
  const hasEnoughContent =
    signals.length >= 3 && snapshots.length >= 1 && candidates.length >= 2;

  const items: { label: string; met: boolean }[] = [
    { label: 'WINNER 状态确认', met: Boolean(winner) },
    { label: '旅程可发布', met: hasEnoughContent },
  ];

  return buildResult('PURCHASE', items, [50, 50]);
}

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function buildResult(
  stage: string,
  items: { label: string; met: boolean }[],
  weights: number | number[],
): CompletenessResult {
  const weightArray = Array.isArray(weights) ? weights : items.map(() => weights);
  let score = 0;
  const missingItems: string[] = [];

  for (let i = 0; i < items.length; i++) {
    if (items[i].met) {
      score += weightArray[i];
    } else {
      missingItems.push(items[i].label);
    }
  }

  const suggestions = missingItems.map((item) => `引导用户补全：${item}`);

  return { stage, score, missingItems, suggestions };
}
