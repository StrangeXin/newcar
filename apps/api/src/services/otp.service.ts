import Redis from 'ioredis';
import { config } from '../config';

export class OtpService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redis.url);
  }

  async generateOtp(phone: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.setex(`otp:${phone}`, 300, otp);
    return otp;
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const cachedOtp = await this.redis.get(`otp:${phone}`);

    if (!cachedOtp) {
      return false;
    }

    const isValid = cachedOtp === otp;

    if (isValid) {
      await this.redis.del(`otp:${phone}`);
    }

    return isValid;
  }
}

export const otpService = new OtpService();
