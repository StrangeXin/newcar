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
      <div className="mb-[7px] flex flex-wrap gap-1">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setValue(action)}
            className="rounded-full border border-[#e5e7eb] bg-[#f3f4f6] px-[9px] py-[3px] text-[10px] font-medium text-[#374151] transition hover:bg-black/5"
          >
            {action}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-[5px]">
        <textarea
          data-testid="chat-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={2}
          placeholder="问我任何购车问题…"
          className="min-h-[34px] flex-1 resize-none rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-[11px] py-[7px] text-[11px] outline-none ring-[#8b5cf6]/25 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          data-testid="chat-send"
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !value.trim()}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[#111] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
