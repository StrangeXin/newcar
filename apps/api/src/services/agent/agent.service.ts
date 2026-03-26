import { createDeepAgent, FilesystemBackend } from 'deepagents';
import { ChatAnthropic } from '@langchain/anthropic';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { config } from '../../config';
import {
  type JourneyWorkspaceContext,
  getWorkspaceRoot,
  buildSystemPrompt,
  ensureWorkspace,
  getJourneyTools,
} from './agent-context';
import {
  type JourneyAgentStreamEvent,
  log,
  trace,
  processStream,
} from './agent-stream';

// Re-export types for public API
export type { JourneyAgentStreamEvent } from './agent-stream';
export type { JourneyWorkspaceContext } from './agent-context';

const journeyAgentCheckpointer = new MemorySaver();

export class JourneyDeepAgentService {
  private getModel() {
    const model = new ChatAnthropic({
      model: config.ai.model as string,
      apiKey: config.ai.apiKey,
      anthropicApiUrl: config.ai.baseURL,
      maxTokens: config.ai.maxTokens,
      temperature: 0.2,
      maxRetries: 2,
      clientOptions: {
        timeout: config.ai.roundTimeoutMs,
      } as Record<string, unknown>,
    });

    return model.withRetry({
      stopAfterAttempt: 3,
      onFailedAttempt: (error) => {
        log('model_retry', {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- withRetry returns RunnableRetry which is structurally compatible but not assignable to BaseLanguageModel
    }) as any;
  }

  private createAgent(journey: JourneyWorkspaceContext['journey'], rootDir: string) {
    return createDeepAgent({
      model: this.getModel(),
      tools: getJourneyTools(journey.id),
      systemPrompt: buildSystemPrompt(journey),
      backend: new FilesystemBackend({ rootDir }),
      checkpointer: journeyAgentCheckpointer,
    });
  }

  async streamJourneyChat(
    context: JourneyWorkspaceContext,
    message: string,
    onEvent?: (event: JourneyAgentStreamEvent) => void
  ) {
    const rootDir = await ensureWorkspace(context);
    const agent = this.createAgent(context.journey, rootDir);
    const threadId = context.conversationId;

    await trace('stream_start', {
      journeyId: context.journey.id,
      conversationId: context.conversationId,
      message,
      threadId,
    });

    const stream = await agent.stream(
      {
        messages: [{ role: 'user', content: message }],
      },
      {
        configurable: { thread_id: threadId },
        streamMode: ['updates', 'messages', 'custom'],
        subgraphs: true,
      }
    );

    const { fullContent, finalAssistantText } = await processStream(stream, context, onEvent);

    const resolvedContent = fullContent.trim() || finalAssistantText.trim();
    await trace('stream_done', {
      journeyId: context.journey.id,
      conversationId: context.conversationId,
      fullContentLength: resolvedContent.length,
      fullContentPreview: resolvedContent.slice(0, 300),
    });
    onEvent?.({ type: 'done', fullContent: resolvedContent });

    return {
      fullContent: resolvedContent,
      workspaceRoot: rootDir,
    };
  }
}

export const journeyDeepAgentService = new JourneyDeepAgentService();
