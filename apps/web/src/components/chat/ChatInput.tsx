'use client';

import { KeyboardEvent, useState } from 'react';

interface ChatInputProps {
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const quickActions = ['帮我对比当前候选', '预算调整到 25 万以内', '再搜一批家用 SUV'];

  async function submit() {
    const content = value.trim();
    if (!content || disabled) {
      return;
    }
    setValue('');
    await onSend(content);
  }

  async function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await submit();
    }
  }

  return (
    <div className="border-t border-black/10 bg-white/90 p-3">
      <div className="mb-3 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setValue(action)}
            className="rounded-full border border-black/10 bg-[#f3f4f6] px-3 py-1.5 text-xs font-semibold text-black/65 transition hover:bg-black/5"
          >
            {action}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={2}
          placeholder="问我任何购车问题…"
          className="min-h-[44px] flex-1 resize-none rounded-2xl border border-black/15 bg-white px-4 py-3 text-sm outline-none ring-[#8b5cf6]/25 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !value.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111] text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
