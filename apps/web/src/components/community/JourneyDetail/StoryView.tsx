interface StoryViewProps {
  content?: string | null;
}

export function StoryView({ content }: StoryViewProps) {
  if (!content) {
    return <p className="text-sm text-[var(--text-muted)]">暂无叙事故事内容。</p>;
  }

  return <article className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-soft)]">{content}</article>;
}
