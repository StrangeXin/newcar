'use client';

const FORMAT_ITEMS = [
  {
    key: 'story',
    title: '叙事故事',
    description: '第一人称经历，适合分享朋友圈',
  },
  {
    key: 'report',
    title: '结构化报告',
    description: '结构化对比结论，方便同类需求参考',
  },
  {
    key: 'template',
    title: '可复用模板',
    description: '他人可直接「从此出发」复用框架',
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
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => toggle(item.key)}
            className={`rounded-xl border p-4 text-left ${
              active ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white'
            }`}
          >
            <p className="text-sm font-semibold">{item.title}</p>
            <p className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-black/60'}`}>{item.description}</p>
          </button>
        );
      })}
    </div>
  );
}
