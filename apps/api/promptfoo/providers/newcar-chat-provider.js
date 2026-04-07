'use strict';

const { resolve } = require('path');

let appInstance = null;
let supertestFn = null;

async function getApp() {
  if (!appInstance) {
    process.env.AI_E2E_MOCK = '1';
    process.env.NODE_ENV = 'test';

    // Use tsx to load the TypeScript app
    const { createApp } = require(resolve(__dirname, '../../src/app'));
    appInstance = createApp();
    supertestFn = require('supertest');
  }
  return { app: appInstance, supertest: supertestFn };
}

class NewcarChatProvider {
  constructor(options = {}) {
    this.config = options.config || {};
    this.roundCounter = 0;
  }

  id() {
    return `newcar-chat:${this.config.scenarioId || 'default'}`;
  }

  async callApi(prompt) {
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

      request.set('x-test-auth', 'e2e-test-token');

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
        error: `Provider error: ${err.message || String(err)}`,
      };
    }
  }
}

module.exports = NewcarChatProvider;
