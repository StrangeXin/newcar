import { ForkButton } from '../ForkButton';
import { StructuredDataView } from './StructuredDataView';

interface TemplateViewProps {
  data?: unknown;
  publishedJourneyId: string;
}

export function TemplateView({ data, publishedJourneyId }: TemplateViewProps) {
  return (
    <div className="space-y-3">
      <StructuredDataView data={data} emptyText="暂无可复用模板内容。" />
      <ForkButton publishedJourneyId={publishedJourneyId} />
    </div>
  );
}
