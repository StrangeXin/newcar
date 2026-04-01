import type { ApiProvider, ProviderResponse } from 'promptfoo';
import { resolve } from 'path';

let appInstance: ReturnType<typeof import('../../src/app').createApp> | null = null;
let supertestFn: typeof import('supertest').default;

async function getApp() {
  if (!appInstance) {
    process.env.AI_E2E_MOCK = '1';
    process.env.NODE_ENV = 'test';

    const { createApp } = await import(resolve(__dirname, '../../src/app'));
    appInstance = createApp();
    supertestFn = (await import('supertest')).default;
  }
  return { app: appInstance, supertest: supertestFn };
}

interface ProviderConfig {
  scenarioId?: string;
  journeyId?: string;
  mode?: 'mock' | 'real-ai';
}

export default class NewcarChatProvider implements ApiProvider {
  private config: ProviderConfig;
  private roundCounter = 0;

  constructor(options: { config?: ProviderConfig; id?: string } = {}) {
    this.config = options.config || {};
  }

  id(): string {
    return `newcar-chat:${this.config.scenarioId || 'default'}`;
  }

  async callApi(prompt: string): Promise<ProviderResponse> {
    this.roundCounter++;
    const { app, supertest } = await getApp();

    const journeyId = this.config.journeyId || 'test-journey-id';

    try {
      const request = supertest(app)
        .post(`/journeys/${journeyId}/chat`)
        .send({ message: prompt });

      if (this.config.scenarioId) {
        request.set('x-scenario-id', this.config.scenarioId);
      }

      const res = await request;

      if (res.status !== 200) {
        return {
          error: `HTTP ${res.status}: ${JSON.stringify(res.body)}`,
        };
      }

      const body = res.body;
      return {
        output: body.message || body.fullContent || '',
        metadata: {
          toolsCalled: body.toolsCalled || [],
          journeyState: body.journeyState || {},
          completeness: body.completeness || {},
          round: this.roundCounter,
        },
      };
    } catch (err) {
      return {
        error: `Provider error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
