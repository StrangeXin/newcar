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
  },

  otp: {
    secret: requireConfigValue(process.env.OTP_SECRET, 'OTP_SECRET'),
  },
};
