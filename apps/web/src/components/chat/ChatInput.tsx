'use client';

import { KeyboardEvent, useState } from 'react';

interface ChatInputProps {
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const quickActions = ['📊 帮我对比两款车', '💰 算一下用车成本', '🏪 附近哪里可试驾'];

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
    <div className="border-t border-black/5 bg-white/90 px-[14px] py-[10px]">
      <div className="mb-[10px] flex flex-wrap gap-[6px]">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setValue(action)}
            className="inline-flex items-center justify-center rounded-full border border-workspace-chipBorder bg-workspace-chipBg px-[10px] py-1 text-[10px] font-medium leading-[1.2] text-workspace-chipText transition hover:bg-black/5"
          >
            {action}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-[6px]">
        <textarea
          data-testid="chat-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="问我任何购车问题…"
          className="h-[38px] min-h-[38px] flex-1 resize-none rounded-[10px] border-[1.5px] border-[#d1d5db] bg-white px-[10px] py-[8px] text-[11px] leading-[1.2] outline-none ring-[#8b5cf6]/25 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          data-testid="chat-send"
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !value.trim()}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#111] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
