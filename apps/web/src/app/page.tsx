import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-black/10 bg-white/90 p-10 shadow-card backdrop-blur-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">NewCar</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
          AI 驱动的购车旅程工作台
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-black/70">
          从需求澄清到最终决策，用一条可追踪的 Journey Canvas 把信息噪音变成明确行动。
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px]"
          >
            登录并开始
          </Link>
          <Link
            href="/journey"
            className="rounded-xl border border-ink/20 bg-white px-6 py-3 text-sm font-semibold transition hover:bg-ink/5"
          >
            查看工作台
          </Link>
        </div>
      </div>
    </main>
  );
}
