import Link from 'next/link';
import { CarFront, MessageSquareText, Route, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12 md:py-16">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/85 p-8 shadow-card backdrop-blur-sm md:p-12">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">NewCar Workspace</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight text-slate-900 md:text-6xl">
              让购车决策像项目管理一样清晰
            </h1>
            <p className="mt-5 max-w-3xl text-base text-slate-700 md:text-lg">
              从需求澄清、候选筛选到最终成交，把分散的信息变成同一条可追踪的 Journey，减少纠结和决策噪音。
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="cursor-pointer rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-orange-500/30 hover:-translate-y-0.5 hover:bg-orange-600"
              >
                立即登录开始
              </Link>
              <Link
                href="/journey"
                className="cursor-pointer rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:-translate-y-0.5 hover:border-slate-400"
              >
                进入工作台预览
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-sky-700">AI Assistant Preview</p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  已识别预算 25 万内，偏好家用
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  <CarFront className="h-4 w-4" aria-hidden="true" />
                  推荐：理想 L6 / 小鹏 G6 / 问界 M7
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  <Route className="h-4 w-4" aria-hidden="true" />
                  下一步：对比续航、空间与用车成本
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-workspace">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-orange-100 text-orange-700">
              <Route className="h-4 w-4" aria-hidden="true" />
            </span>
            旅程看板
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            每个候选车型的证据、风险和结论都在同一处沉淀，团队协同更高效。
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-workspace">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            </span>
            AI 对话驱动
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            用自然语言补全需求、对比车型并生成下一步行动建议，减少信息盲区。
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-workspace">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-orange-100 text-orange-700">
              <CarFront className="h-4 w-4" aria-hidden="true" />
            </span>
            结果可复盘
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            关键决策路径与依据自动保留，方便回看与沉淀可复用的购车方法论。
          </p>
        </article>
      </section>
    </main>
  );
}
