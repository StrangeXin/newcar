import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => mockRedis),
}));

vi.mock('../src/config', () => ({
  config: {
    redis: { url: 'redis://localhost:6379' },
  },
}));

import { OtpService } from '../src/services/otp.service';

let otpService: OtpService;

beforeEach(() => {
  vi.clearAllMocks();
  otpService = new OtpService();
});

describe('OtpService', () => {
  describe('generateOtp', () => {
    it('should generate 6-digit OTP and store in Redis with TTL 300', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const otp = await otpService.generateOtp('13800138000');

      expect(otp).toMatch(/^\d{6}$/);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'otp:13800138000',
        300,
        otp,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should return true and delete key when OTP matches', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.del.mockResolvedValue(1);

      const result = await otpService.verifyOtp('13800138000', '123456');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('otp:13800138000');
    });

    it('should return false and not delete when OTP does not match', async () => {
      mockRedis.get.mockResolvedValue('123456');

      const result = await otpService.verifyOtp('13800138000', '999999');

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return false when OTP expired (null from Redis)', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await otpService.verifyOtp('13800138000', '123456');

      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
