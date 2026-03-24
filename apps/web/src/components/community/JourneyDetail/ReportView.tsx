import { StructuredDataView } from './StructuredDataView';

interface ReportViewProps {
  data?: unknown;
}

export function ReportView({ data }: ReportViewProps) {
  return <StructuredDataView data={data} emptyText="暂无结构化报告内容。" />;
}
