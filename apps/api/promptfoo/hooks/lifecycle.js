'use strict';

// beforeAll: 设置测试环境
async function beforeAll(_config, _context) {
  process.env.AI_E2E_MOCK = '1';
  process.env.NODE_ENV = 'test';
  console.log('[lifecycle] Test environment initialized');
}

// afterAll: 输出完整度报告
async function afterAll(_config, context) {
  const results = context.results || [];
  const passed = results.filter((r) => r.success).length;
  const total = results.length;
  console.log(`[lifecycle] Test complete: ${passed}/${total} passed`);
}

module.exports = { beforeAll, afterAll };
