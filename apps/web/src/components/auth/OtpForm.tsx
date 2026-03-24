'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api';
import { setToken } from '@/lib/auth';

interface SendOtpResponse {
  message: string;
  otp?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export function OtpForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintOtp, setHintOtp] = useState<string | null>(null);

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim()) {
      setError('请输入手机号');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await post<SendOtpResponse>('/auth/phone/send-otp', { phone: phone.trim() });
      setHintOtp(result.otp || null);
      setStep(2);
    } catch (err) {
      setError((err as Error).message || '验证码发送失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    if (!otp.trim()) {
      setError('请输入验证码');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await post<LoginResponse>('/auth/phone/login', {
        phone: phone.trim(),
        otp: otp.trim(),
      });
      setToken(result.accessToken);
      router.push('/journey');
      router.refresh();
    } catch (err) {
      setError((err as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {step === 1 ? (
        <form onSubmit={handleSendOtp} className="space-y-3" noValidate>
          <label className="block text-sm font-medium text-slate-700" htmlFor="phone">
            手机号
          </label>
          <input
            data-testid="login-phone-input"
            id="phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'otp-error' : undefined}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入手机号"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-sky-300 transition focus:ring-2"
          />
          <button
            data-testid="send-otp-button"
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '发送中...' : '发送验证码'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3" noValidate>
          <label className="block text-sm font-medium text-slate-700" htmlFor="otp">
            验证码
          </label>
          <input
            data-testid="login-otp-input"
            id="otp"
            inputMode="numeric"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'otp-error' : hintOtp ? 'otp-hint' : undefined}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="请输入6位验证码"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none ring-sky-300 transition focus:ring-2"
          />
          <button
            data-testid="verify-otp-button"
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '登录中...' : '验证并登录'}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400"
          >
            返回修改手机号
          </button>
        </form>
      )}

      {hintOtp ? (
        <p
          id="otp-hint"
          data-testid="otp-hint"
          aria-live="polite"
          className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700"
        >
          开发环境验证码：{hintOtp}
        </p>
      ) : null}
      {error ? (
        <p id="otp-error" role="alert" aria-live="assertive" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
