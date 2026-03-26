import { AIMessageChunk, ToolMessage } from 'langchain';
import { logger } from '../../lib/logger';
import { config } from '../../config';
import type { ChatSideEffect, ChatToolName } from '../../tools/chat-tools';
import type { JourneyWorkspaceContext } from './agent-context';
import { promises as fs } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JourneyAgentStreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'tool_start'; name: string; input: Record<string, unknown> }
  | { type: 'tool_done'; name: string; result: unknown }
  | { type: 'side_effect'; event: ChatSideEffect['event']; data: unknown }
  | { type: 'done'; fullContent: string }
  | { type: 'error'; code: string; message: string };

export const DOMAIN_TOOLS = new Set<ChatToolName>(['car_search', 'car_detail', 'journey_update', 'add_candidate']);

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

export function log(event: string, details?: Record<string, unknown>) {
  if (!config.ai.debug) {
    return;
  }

  logger.info({ event, ...details }, '[deep-agent]');
}

export async function trace(event: string, details?: Record<string, unknown>) {
  if (!config.ai.trace) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };

  logger.info({ event, ...details }, '[deep-agent-trace]');
  await fs.appendFile(config.ai.traceFile, `${JSON.stringify(payload)}\n`, 'utf-8');
}

// ---------------------------------------------------------------------------
// Text / message extraction helpers
// ---------------------------------------------------------------------------

export function extractText(value: unknown): string {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => extractText(item)).join('');
  }
  if (typeof value === 'object') {
    const maybeRecord = value as Record<string, unknown>;
    if (typeof maybeRecord.text === 'string') {
      return maybeRecord.text;
    }
    if (maybeRecord.type === 'text' && typeof maybeRecord.text === 'string') {
      return maybeRecord.text;
    }
    if ('content' in maybeRecord) {
      return extractText(maybeRecord.content);
    }
    if ('output' in maybeRecord) {
      return extractText(maybeRecord.output);
    }
    if ('messages' in maybeRecord) {
      return extractText(maybeRecord.messages);
    }
  }
  return '';
}

export function maybeParseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeToolInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const record = input as Record<string, unknown>;
  if ('input' in record) {
    const parsed = maybeParseJson(record.input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  return record;
}

export function normalizeToolOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object') {
    return maybeParseJson(output);
  }

  const record = output as Record<string, unknown>;
  if ('artifact' in record && record.artifact !== undefined) {
    return record.artifact;
  }
  if ('lc_direct_tool_output' in record && record.lc_direct_tool_output !== undefined) {
    return record.lc_direct_tool_output;
  }
  if ('content' in record) {
    return maybeParseJson(record.content);
  }

  return record;
}

export function getLastAssistantText(output: unknown): string {
  if (!output || typeof output !== 'object') {
    return '';
  }

  const messages = (output as { messages?: unknown[] }).messages;
  if (!Array.isArray(messages)) {
    return '';
  }

  const assistantMessages = messages.filter((message) => {
    if (!message || typeof message !== 'object') {
      return false;
    }
    const getType = (message as Record<string, unknown>)._getType;
    if (typeof getType === 'function') {
      return getType.call(message) === 'ai';
    }
    return (message as Record<string, unknown>).type === 'ai';
  });

  const last = assistantMessages.at(-1) as { content?: unknown } | undefined;
  return extractText(last?.content);
}

export function isToolLikeMessage(message: unknown) {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (ToolMessage.isInstance(message as Record<string, unknown>)) {
    return true;
  }

  const maybeType = (message as { type?: string }).type;
  const getType = (message as { _getType?: () => string })._getType;
  return maybeType === 'tool' || (typeof getType === 'function' && getType.call(message) === 'tool');
}

export function getToolCallId(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const record = message as Record<string, unknown>;
  return typeof record.tool_call_id === 'string' ? record.tool_call_id : undefined;
}

export function getToolName(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const record = message as Record<string, unknown>;
  return typeof record.name === 'string' ? record.name : undefined;
}

export function getToolCalls(message: unknown): Array<{ id?: string; name?: string; args?: unknown }> {
  if (!message || typeof message !== 'object') {
    return [];
  }

  const record = message as Record<string, unknown>;
  const toolCalls = Array.isArray(record.tool_calls) ? record.tool_calls : [];
  return toolCalls
    .map((toolCall) => {
      if (!toolCall || typeof toolCall !== 'object') {
        return null;
      }

      const value = toolCall as Record<string, unknown>;
      return {
        id: typeof value.id === 'string' ? value.id : undefined,
        name: typeof value.name === 'string' ? value.name : undefined,
        args: value.args,
      };
    })
    .filter(Boolean) as Array<{ id?: string; name?: string; args?: unknown }>;
}

export function summarizeUpdateData(data: unknown) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([nodeName, nodeData]) => {
      const messages = Array.isArray((nodeData as { messages?: unknown[] })?.messages)
        ? ((nodeData as { messages?: unknown[] }).messages as unknown[])
        : [];

      return [
        nodeName,
        {
          messageCount: messages.length,
          textPreview: getLastAssistantText(nodeData).slice(0, 160),
          toolCalls: messages.flatMap((message) =>
            getToolCalls(message).map((toolCall) => ({
              id: toolCall.id,
              name: toolCall.name,
              args: normalizeToolInput(toolCall.args),
            }))
          ),
          toolMessages: messages
            .filter((message) => isToolLikeMessage(message))
            .map((message) => ({
              toolCallId: getToolCallId(message),
              name: getToolName(message),
              contentPreview: extractText((message as { content?: unknown }).content).slice(0, 160),
            })),
        },
      ];
    })
  );
}

// ---------------------------------------------------------------------------
// Stream processing
// ---------------------------------------------------------------------------

export async function processStream(
  stream: AsyncIterable<unknown>,
  context: JourneyWorkspaceContext,
  onEvent?: (event: JourneyAgentStreamEvent) => void
): Promise<{ fullContent: string; finalAssistantText: string }> {
  let fullContent = '';
  let finalAssistantText = '';
  const startedToolCalls = new Set<string>();
  const finishedToolCalls = new Set<string>();

  const iterator = (stream as AsyncIterable<unknown>)[Symbol.asyncIterator]();

  try {
    while (true) {
      const nextEvent = await Promise.race([
        iterator.next(),
        new Promise<IteratorResult<unknown>>((_, reject) =>
          setTimeout(() => reject(new Error(`deep_agent_stream_idle_timeout:${config.ai.roundTimeoutMs}`)), config.ai.roundTimeoutMs)
        ),
      ]);

      if (nextEvent.done) {
        break;
      }

      const [namespace, mode, data] = nextEvent.value as [string[], string, unknown];
      const isMainNamespace = Array.isArray(namespace) && namespace.length === 0;
      await trace('stream_chunk', {
        journeyId: context.journey.id,
        conversationId: context.conversationId,
        namespace,
        mode,
        summary:
          mode === 'messages'
            ? {
                metadata: Array.isArray(data) ? data[1] : null,
                textPreview: Array.isArray(data) ? extractText((data[0] as { text?: unknown })?.text).slice(0, 160) : '',
              }
            : mode === 'custom'
              ? data
              : summarizeUpdateData(data),
      });

      if (mode === 'messages') {
        const [messageChunk, metadata] = Array.isArray(data) ? data : [null, null];

        if (
          isMainNamespace &&
          AIMessageChunk.isInstance(messageChunk as Record<string, unknown>) &&
          (metadata as Record<string, unknown> | null)?.langgraph_node === 'model_request'
        ) {
          const delta = extractText((messageChunk as { text?: unknown }).text);
          const toolCallChunks = (messageChunk as { tool_call_chunks?: unknown[] }).tool_call_chunks;
          if (delta && (!Array.isArray(toolCallChunks) || toolCallChunks.length === 0)) {
            fullContent += delta;
            onEvent?.({ type: 'token', delta });
          }
        }
        continue;
      }

      if (mode === 'custom') {
        if (isMainNamespace) {
          const payload = (data || {}) as ChatSideEffect;
          if (payload?.event) {
            onEvent?.({
              type: 'side_effect',
              event: payload.event,
              data: payload.data,
            });
          }
        }
        continue;
      }

      if (mode === 'updates' && isMainNamespace && data && typeof data === 'object') {
        for (const [nodeName, nodeData] of Object.entries(data as Record<string, unknown>)) {
          finalAssistantText = getLastAssistantText(nodeData) || finalAssistantText;

          const messages = Array.isArray((nodeData as { messages?: unknown[] })?.messages)
            ? ((nodeData as { messages?: unknown[] }).messages as unknown[])
            : [];

          if (nodeName === 'model_request') {
            for (const graphMessage of messages) {
              for (const toolCall of getToolCalls(graphMessage)) {
                if (!toolCall.name || !DOMAIN_TOOLS.has(toolCall.name as ChatToolName)) {
                  continue;
                }

                const callId = toolCall.id || `${toolCall.name}:${JSON.stringify(toolCall.args ?? {})}`;
                if (startedToolCalls.has(callId)) {
                  continue;
                }

                startedToolCalls.add(callId);
                onEvent?.({
                  type: 'tool_start',
                  name: toolCall.name,
                  input: normalizeToolInput(toolCall.args),
                });
              }
            }
          }

          if (nodeName === 'tools') {
            for (const graphMessage of messages) {
              if (!isToolLikeMessage(graphMessage)) {
                continue;
              }

              const toolName = getToolName(graphMessage);
              if (!toolName || !DOMAIN_TOOLS.has(toolName as ChatToolName)) {
                continue;
              }

              const callId = getToolCallId(graphMessage) || `${toolName}:${extractText((graphMessage as { content?: unknown }).content)}`;
              if (finishedToolCalls.has(callId)) {
                continue;
              }

              finishedToolCalls.add(callId);
              onEvent?.({
                type: 'tool_done',
                name: toolName,
                result: normalizeToolOutput((graphMessage as { content?: unknown }).content),
              });
            }
          }
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('stream_error', {
      journeyId: context.journey.id,
      conversationId: context.conversationId,
      message,
      fullContentLength: fullContent.length,
      finalAssistantTextLength: finalAssistantText.length,
    });
    await trace('stream_error', {
      journeyId: context.journey.id,
      conversationId: context.conversationId,
      message,
      fullContentLength: fullContent.length,
      finalAssistantTextLength: finalAssistantText.length,
    });

    const canGracefullyFinish =
      fullContent.trim().length > 0 || finalAssistantText.trim().length > 0;

    if (!canGracefullyFinish) {
      throw error;
    }
  }

  return { fullContent, finalAssistantText };
}
