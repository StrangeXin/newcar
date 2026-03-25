'use client';

import { BookText, ClipboardList, FileStack } from 'lucide-react';

const FORMAT_ITEMS = [
  {
    key: 'story',
    title: '叙事故事',
    description: '第一人称经历，适合分享朋友圈',
    icon: BookText,
  },
  {
    key: 'report',
    title: '结构化报告',
    description: '结构化对比结论，方便同类需求参考',
    icon: ClipboardList,
  },
  {
    key: 'template',
    title: '可复用模板',
    description: '他人可直接「从此出发」复用框架',
    icon: FileStack,
  },
];

interface FormatSelectorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function FormatSelector({ value, onChange }: FormatSelectorProps) {
  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((item) => item !== key));
      return;
    }
    onChange([...value, key]);
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {FORMAT_ITEMS.map((item) => {
        const active = value.includes(item.key);
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => toggle(item.key)}
            className={`cursor-pointer rounded-xl border p-4 text-left ${
              active
                ? 'border-[var(--accent-text)] bg-[var(--accent-text)] text-white'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--border-soft)]'
            }`}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.title}
            </p>
            <p className={`mt-1 text-xs ${active ? 'text-white/85' : 'text-[var(--text-muted)]'}`}>{item.description}</p>
          </button>
        );
      })}
    </div>
  );
}
