'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { post } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { useT } from '@/hooks/useT';

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
  const t = useT();
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
          <label className="block text-sm font-medium text-[var(--text-soft)]" htmlFor="phone">
            {t['auth.phone.label']}
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
            placeholder={t['auth.phone.placeholder']}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none ring-[var(--accent-border)] transition focus:ring-2"
          />
          <button
            data-testid="send-otp-button"
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t['auth.sending'] : t['auth.send_code']}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3" noValidate>
          <label className="block text-sm font-medium text-[var(--text-soft)]" htmlFor="otp">
            {t['auth.otp.label']}
          </label>
          <input
            data-testid="login-otp-input"
            id="otp"
            inputMode="numeric"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'otp-error' : hintOtp ? 'otp-hint' : undefined}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder={t['auth.otp.placeholder']}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm outline-none ring-[var(--accent-border)] transition focus:ring-2"
          />
          <button
            data-testid="verify-otp-button"
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t['auth.logging_in'] : t['auth.login']}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--text)] hover:border-[var(--border-soft)]"
          >
            {t['auth.back']}
          </button>
        </form>
      )}

      {hintOtp ? (
        <p
          id="otp-hint"
          data-testid="otp-hint"
          aria-live="polite"
          className="rounded-lg bg-[var(--warning-muted)] px-3 py-2 text-xs text-[var(--warning-text)]"
        >
          {t['auth.dev_hint'].replace('123456', hintOtp)}
        </p>
      ) : null}
      {error ? (
        <p id="otp-error" role="alert" aria-live="assertive" className="text-sm text-[var(--error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
