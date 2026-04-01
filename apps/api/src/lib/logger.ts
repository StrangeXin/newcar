import pino from 'pino';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// 确保日志目录存在
const logDir = resolve(__dirname, '../../logs');
if (!isTest) {
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // 忽略：目录可能已存在或无权限
  }
}

function createLogger() {
  const level = process.env.LOG_LEVEL || 'info';

  if (isTest) {
    // 测试环境：静默
    return pino({ level: 'silent' });
  }

  if (isProduction) {
    // 生产环境：JSON 写文件
    return pino(
      { level },
      pino.destination({ dest: resolve(logDir, 'api.log'), sync: false }),
    );
  }

  // 开发环境：stdout (pretty) + 文件 (JSON) 双写
  const streams = pino.multistream([
    {
      level: level as pino.Level,
      stream: pino.transport({ target: 'pino-pretty', options: { colorize: true } }),
    },
    {
      level: level as pino.Level,
      stream: pino.destination({ dest: resolve(logDir, 'api.log'), sync: false }),
    },
  ]);

  return pino({ level }, streams);
}

export const logger = createLogger();
