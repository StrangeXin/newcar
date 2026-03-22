import { OtpForm } from '@/components/auth/OtpForm';
import { WechatLoginButton } from '@/components/auth/WechatLoginButton';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-16">
      <div className="grid w-full gap-8 rounded-3xl border border-black/10 bg-white/90 p-8 shadow-card backdrop-blur-sm md:grid-cols-2">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">Authentication</p>
          <h1 className="mt-2 text-3xl font-bold">登录 NewCar 工作台</h1>
          <p className="mt-3 text-sm text-black/65">
            使用手机号验证码登录。后续将支持微信小程序 OAuth。
          </p>
          <div className="mt-6">
            <OtpForm />
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-pearl p-6">
          <h2 className="text-lg font-semibold">微信快捷登录</h2>
          <p className="mt-2 text-sm text-black/60">
            需要在小程序环境下授权，目前 Web 端先提供占位入口。
          </p>
          <div className="mt-6">
            <WechatLoginButton />
          </div>
        </section>
      </div>
    </main>
  );
}
