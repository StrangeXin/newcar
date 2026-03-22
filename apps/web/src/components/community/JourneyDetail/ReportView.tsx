interface ReportViewProps {
  data?: unknown;
}

export function ReportView({ data }: ReportViewProps) {
  if (!data) {
    return <p className="text-sm text-black/60">暂无结构化报告内容。</p>;
  }

  return (
    <pre className="overflow-auto rounded-xl border border-black/10 bg-white p-4 text-xs text-black/75">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
