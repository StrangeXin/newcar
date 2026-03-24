interface StoryViewProps {
  content?: string | null;
}

export function StoryView({ content }: StoryViewProps) {
  if (!content) {
    return <p className="text-sm text-slate-500">暂无叙事故事内容。</p>;
  }

  return <article className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{content}</article>;
}
