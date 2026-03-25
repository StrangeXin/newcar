import Link from 'next/link';
import { CarFront, MessageSquareText, Route } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { JourneyCarousel } from '@/components/home/JourneyCarousel';

export default function HomePage() {
  return (
    <>
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-[var(--border-soft)]/50 bg-[var(--bg)]/80 px-6 py-3 backdrop-blur-md">
        <span className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-bold text-[var(--text)]">
          NewCar
        </span>
        <div className="flex items-center gap-3">
          <Link href="/community" className="text-[var(--text-sm)] font-medium text-[var(--text-soft)] hover:text-[var(--text)]">
            社区
          </Link>
          <Link href="/login">
            <Button size="sm">登录</Button>
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl px-6 pb-12 pt-20">
        <div className="flex min-h-[calc(100vh-5rem)] items-center">
        <section className="grid w-full items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.16em] text-[var(--accent-text-soft)]">
              NewCar Workspace
            </p>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-[var(--text-4xl)] font-extrabold leading-[var(--leading-tight)] text-[var(--text)]">
              让购车决策像项目管理一样清晰
            </h1>
            <p className="mt-1 font-[family-name:var(--font-display)] text-[var(--text-xl)] text-[var(--text-soft)]">
              Your car buying journey, organized.
            </p>
            <p className="mt-5 text-[var(--text-base)] leading-[var(--leading-relaxed)] text-[var(--text-soft)]">
              从需求澄清、候选筛选到最终成交，把分散的信息变成同一条可追踪的 Journey，减少纠结和决策噪音。
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/login"><Button size="lg">开始我的旅程</Button></Link>
              <Link href="/community"><Button variant="secondary" size="lg">浏览社区</Button></Link>
            </div>
          </div>
          <JourneyCarousel t={{}} />
        </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-muted)] text-[var(--accent-text)]">
                <Route className="h-4 w-4" aria-hidden="true" />
              </span>
              旅程看板
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              每个候选车型的证据、风险和结论都在同一处沉淀，团队协同更高效。
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--success-muted)] text-[var(--success-text)]">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              </span>
              AI 对话驱动
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              用自然语言补全需求、对比车型并生成下一步行动建议，减少信息盲区。
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text)]">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-muted)] text-[var(--accent-text)]">
                <CarFront className="h-4 w-4" aria-hidden="true" />
              </span>
              结果可复盘
            </h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              关键决策路径与依据自动保留，方便回看与沉淀可复用的购车方法论。
            </p>
          </article>
        </section>
      </main>
    </>
  );
}
