import { ReportData } from '@/types/api';
import { StructuredDataView } from './StructuredDataView';

interface ReportViewProps {
  data?: unknown;
}

function isReportData(data: unknown): data is ReportData {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data) && 'userProfile' in (data as Record<string, unknown>);
}

export function ReportView({ data }: ReportViewProps) {
  if (isReportData(data)) {
    const dimensions = data.userProfile.coreDimensions || [];
    return (
      <div className="space-y-5">
        <section className="rounded-[16px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
          <h3 className="text-sm font-bold text-[var(--text)]">我的需求</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">预算</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{data.userProfile.budget}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">燃油偏好</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{data.userProfile.fuelPreference}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">使用场景</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{data.userProfile.useCases.join('、') || '未标注'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">核心维度</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{dimensions.join('、') || '未标注'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-sm font-bold text-[var(--text)]">候选车对比</h3>
          <div className="mt-4 space-y-4">
            {data.comparison.map((item) => (
              <article key={item.carName} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[var(--text)]">{item.carName}</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">{item.highlight}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {Object.entries(item.scores).map(([label, score]) => (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="text-[var(--text-soft)]">{label}</span>
                        <span className="font-semibold text-[var(--text)]">{score}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--border)]">
                        <div className="h-2 rounded-full bg-[var(--accent)]" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[16px] border border-[var(--accent-border)] bg-[var(--accent-muted)] p-4">
          <h3 className="text-sm font-bold text-[var(--accent-text)]">最终推荐</h3>
          <p className="mt-2 text-lg font-bold text-[var(--text)]">{data.recommendation.carName}</p>
          <p className="mt-2 text-sm leading-7 text-[var(--accent-text)]">{data.recommendation.reasoning}</p>
        </section>
      </div>
    );
  }

  return <StructuredDataView data={data} emptyText="暂无结构化报告内容。" />;
}
