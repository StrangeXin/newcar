import type { CompletenessResult } from '@newcar/shared';

export function buildCompletenessBlock(result: CompletenessResult): string {
  const lines = [
    '## 当前旅程状态',
    `- 阶段: ${result.stage}`,
    `- 完整度: ${result.score}/100`,
  ];

  if (result.missingItems.length > 0) {
    lines.push(`- 缺失信息: ${result.missingItems.join(', ')}`);
  }

  lines.push('');
  lines.push('## 引导策略');
  lines.push('根据缺失信息，自然地在对话中引导用户补全。');
  lines.push('不要一次问太多问题，每轮聚焦 1-2 个点。');
  lines.push('如果用户主动换话题或换车，跟随用户节奏，不要强拉回来。');
  lines.push('当完整度 >= 80 时，可以建议推进到下一阶段，但不要强制。');
  lines.push('用户在做决定前更换候选车是完全正常的，帮助用户重新梳理即可。');

  return lines.join('\n');
}
