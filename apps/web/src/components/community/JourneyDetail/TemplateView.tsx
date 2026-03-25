import { ForkButton } from '../ForkButton';
import { TemplateData } from '@/types/api';
import { StructuredDataView } from './StructuredDataView';

interface TemplateViewProps {
  data?: unknown;
  publishedJourneyId: string;
}

export function TemplateView({ data, publishedJourneyId }: TemplateViewProps) {
  const template = data as TemplateData | undefined;
  const hasStructuredTemplate =
    template &&
    typeof template === 'object' &&
    !Array.isArray(template) &&
    Array.isArray(template.dimensions) &&
    Array.isArray(template.keyQuestions);

  return (
    <div data-testid="template-view" className="space-y-3">
      {hasStructuredTemplate ? (
        <div className="space-y-4">
          <section data-testid="template-dimensions" className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <h3 className="text-sm font-bold text-[var(--text)]">对比维度</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {template.dimensions.map((dimension) => (
                <span key={dimension} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[length:var(--text-xs)] text-[var(--text-soft)]">
                  {dimension}
                  {typeof template.weights?.[dimension] === 'number' ? ` · ${Math.round(template.weights[dimension] * 100)}%` : ''}
                </span>
              ))}
            </div>
          </section>

          <section data-testid="template-questions" className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-sm font-bold text-[var(--text)]">买车前要想清楚的问题</h3>
            <ol className="mt-3 space-y-2 text-sm text-[var(--text-soft)]">
              {template.keyQuestions.map((question, index) => (
                <li key={question}>
                  {index + 1}. {question}
                </li>
              ))}
            </ol>
          </section>

          {template.candidateNames?.length ? (
            <section className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm font-bold text-[var(--text)]">作者的候选车</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {template.candidateNames.map((name) => (
                  <span key={name} className="rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[length:var(--text-xs)] text-[var(--text-soft)]">
                    {name}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <StructuredDataView data={data} emptyText="暂无可复用模板内容。" />
      )}
      <ForkButton publishedJourneyId={publishedJourneyId} />
    </div>
  );
}
