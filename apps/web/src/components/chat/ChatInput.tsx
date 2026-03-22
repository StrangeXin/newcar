'use client';

import { KeyboardEvent, useState } from 'react';

interface ChatInputProps {
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState('');

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
    <div className="border-t border-black/10 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        rows={2}
        placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
        className="w-full resize-none rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-ember/30 transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || !value.trim()}
          className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          发送
        </button>
      </div>
    </div>
  );
}
