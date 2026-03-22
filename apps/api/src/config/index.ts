import dotenv from 'dotenv';
import { requireConfigValue, requireEnvVar } from '../lib/utils';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: isProduction
      ? requireEnvVar('DATABASE_URL')
      : process.env.DATABASE_URL || 'postgresql://newcar:newcar_dev@localhost:5433/newcar',
  },

  redis: {
    url: isProduction ? requireEnvVar('REDIS_URL') : process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: requireConfigValue(process.env.JWT_SECRET, 'JWT_SECRET'),
    expiresIn: '7d',
  },

  wechat: {
    appId: requireConfigValue(process.env.WECHAT_APP_ID, 'WECHAT_APP_ID'),
    appSecret: requireConfigValue(process.env.WECHAT_APP_SECRET, 'WECHAT_APP_SECRET'),
    templateIds: {
      PRICE_DROP: process.env.WECHAT_TEMPLATE_PRICE_DROP || '',
      NEW_REVIEW: process.env.WECHAT_TEMPLATE_NEW_REVIEW || '',
      POLICY_UPDATE: process.env.WECHAT_TEMPLATE_POLICY_UPDATE || '',
      OTA_RECALL: process.env.WECHAT_TEMPLATE_OTA_RECALL || '',
    },
  },

  otp: {
    secret: requireConfigValue(process.env.OTP_SECRET, 'OTP_SECRET'),
  },

  ai: {
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'MiniMax-M2.7',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024', 10),
    baseURL: process.env.AI_BASE_URL || 'https://api.minimaxi.com/anthropic',
  },
};
