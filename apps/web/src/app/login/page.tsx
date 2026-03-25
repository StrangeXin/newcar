import { CircleCheckBig, LockKeyhole, MessageSquareText, Smartphone } from 'lucide-react';
import { OtpForm } from '@/components/auth/OtpForm';
import { WechatLoginButton } from '@/components/auth/WechatLoginButton';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12 md:py-16">
      <div className="grid w-full gap-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-6 shadow-card backdrop-blur-sm md:grid-cols-2 md:p-10">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-text-soft)]">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Authentication
          </p>
          <h1 className="mt-3 inline-flex items-center gap-2 text-3xl font-extrabold text-[var(--text)]">
            <Smartphone className="h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
            登录 NewCar 工作台
          </h1>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            使用手机号验证码快速登录。后续会支持微信小程序 OAuth。
          </p>
          <div className="mt-6">
            <OtpForm />
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
          <h2 className="inline-flex items-center gap-1.5 text-lg font-bold text-[var(--text)]">
            <MessageSquareText className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            为什么使用 NewCar
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
            <li className="inline-flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <CircleCheckBig className="h-4 w-4 text-[var(--success-text)]" aria-hidden="true" />
              对话即需求，自动沉淀为可执行购车清单。
            </li>
            <li className="inline-flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <CircleCheckBig className="h-4 w-4 text-[var(--success-text)]" aria-hidden="true" />
              候选车型比较过程透明，避免反复横跳。
            </li>
            <li className="inline-flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <CircleCheckBig className="h-4 w-4 text-[var(--success-text)]" aria-hidden="true" />
              关键结论和依据可追踪，便于复盘和协作。
            </li>
          </ul>
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-[var(--text)]">微信快捷登录</p>
            <WechatLoginButton />
          </div>
        </section>
      </div>
    </main>
  );
}
