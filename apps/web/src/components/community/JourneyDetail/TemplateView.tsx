import { ForkButton } from '../ForkButton';

interface TemplateViewProps {
  data?: unknown;
  publishedJourneyId: string;
}

export function TemplateView({ data, publishedJourneyId }: TemplateViewProps) {
  return (
    <div className="space-y-3">
      {data ? (
        <pre className="overflow-auto rounded-xl border border-black/10 bg-white p-4 text-xs text-black/75">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-black/60">暂无可复用模板内容。</p>
      )}
      <ForkButton publishedJourneyId={publishedJourneyId} />
    </div>
  );
}
