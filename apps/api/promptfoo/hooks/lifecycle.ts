import type { UnifiedConfig } from 'promptfoo';

interface HookContext {
  vars?: Record<string, unknown>;
  results?: unknown[];
}

// beforeAll: 设置测试环境
export async function beforeAll(
  _config: UnifiedConfig,
  _context: HookContext,
): Promise<void> {
  process.env.AI_E2E_MOCK = '1';
  process.env.NODE_ENV = 'test';
  console.log('[lifecycle] Test environment initialized');
}

// afterAll: 输出完整度报告
export async function afterAll(
  _config: UnifiedConfig,
  context: HookContext,
): Promise<void> {
  const results = context.results || [];
  const passed = (results as Array<{ success?: boolean }>).filter((r) => r.success).length;
  const total = results.length;
  console.log(`[lifecycle] Test complete: ${passed}/${total} passed`);
}
