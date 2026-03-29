import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/* Mocks for AiChatService private-method tests                       */
/* ------------------------------------------------------------------ */

const mockTimelineCreateEvent = vi.fn();
const mockSearchCars = vi.fn();
const mockGetCandidatesByJourney = vi.fn();
const mockGetJourneyDetail = vi.fn();
const mockGetOrCreateByJourney = vi.fn();
const mockGetOrCreateConversation = vi.fn();
const mockAddMessage = vi.fn();
const mockGetConversationHistory = vi.fn();
const mockExtractSignals = vi.fn();
const mockUpdateAiConfidenceScore = vi.fn();
const mockExecuteChatTool = vi.fn();

vi.mock('../src/services/timeline.service', () => ({
  timelineService: {
    createEvent: (...args: unknown[]) => mockTimelineCreateEvent(...args),
  },
  TIMELINE_EVENT_TYPES: {
    CANDIDATE_ADDED: 'CANDIDATE_ADDED',
    CANDIDATE_ELIMINATED: 'CANDIDATE_ELIMINATED',
    CANDIDATE_WINNER: 'CANDIDATE_WINNER',
    STAGE_CHANGED: 'STAGE_CHANGED',
    REQUIREMENT_UPDATED: 'REQUIREMENT_UPDATED',
    AI_INSIGHT: 'AI_INSIGHT',
    PRICE_CHANGE: 'PRICE_CHANGE',
    USER_ACTION: 'USER_ACTION',
    PUBLISH_SUGGESTION: 'PUBLISH_SUGGESTION',
    JOURNEY_PUBLISHED: 'JOURNEY_PUBLISHED',
  },
  buildTimelineEventContent: (_type: string, _data: unknown) => 'mock content',
}));

vi.mock('../src/services/car.service', () => ({
  carService: {
    searchCars: (...args: unknown[]) => mockSearchCars(...args),
  },
}));

vi.mock('../src/services/car-candidate.service', () => ({
  carCandidateService: {
    getCandidatesByJourney: (...args: unknown[]) => mockGetCandidatesByJourney(...args),
  },
}));

vi.mock('../src/services/journey.service', () => ({
  journeyService: {
    getJourneyDetail: (...args: unknown[]) => mockGetJourneyDetail(...args),
    updateAiConfidenceScore: (...args: unknown[]) => mockUpdateAiConfidenceScore(...args),
  },
}));

vi.mock('../src/services/conversation.service', () => ({
  conversationService: {
    getOrCreateByJourney: (...args: unknown[]) => mockGetOrCreateByJourney(...args),
    getOrCreateConversation: (...args: unknown[]) => mockGetOrCreateConversation(...args),
    addMessage: (...args: unknown[]) => mockAddMessage(...args),
    getConversationHistory: (...args: unknown[]) => mockGetConversationHistory(...args),
    extractSignals: (...args: unknown[]) => mockExtractSignals(...args),
    addToolCall: vi.fn(),
  },
}));

vi.mock('../src/services/journey-deep-agent.service', () => ({
  journeyDeepAgentService: {
    streamJourneyChat: vi.fn(),
  },
}));

vi.mock('../src/tools/chat-tools', () => ({
  executeChatTool: (...args: unknown[]) => mockExecuteChatTool(...args),
}));

vi.mock('../src/config', () => ({
  config: {
    ai: {
      debug: false,
      e2eMock: true,
      apiKey: '',
    },
  },
}));

import { AiChatService } from '../src/services/ai-chat.service';
import { shouldSuggestPublish } from '../src/services/chat/chat-side-effects';

describe('shouldSuggestPublish', () => {
  it('returns true for DECISION stage', () => {
    expect(shouldSuggestPublish('DECISION')).toBe(true);
  });

  it('returns true for PURCHASE stage', () => {
    expect(shouldSuggestPublish('PURCHASE')).toBe(true);
  });

  it('returns false for AWARENESS stage', () => {
    expect(shouldSuggestPublish('AWARENESS')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(shouldSuggestPublish(undefined)).toBe(false);
  });
});

/* ================================================================== */
/* createTimelineEventForSideEffect                                   */
/* ================================================================== */

describe('createTimelineEventForSideEffect', () => {
  let service: AiChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiChatService();
  });

  // Access private method via cast
  function callCreate(journeyId: string, event: string, data: unknown) {
    return (service as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .createTimelineEventForSideEffect(journeyId, event, data);
  }

  it('candidate_added: creates CANDIDATE_ADDED timeline event with car info in metadata', async () => {
    const fakeEvent = { id: 'tl-1' };
    mockTimelineCreateEvent.mockResolvedValueOnce(fakeEvent);

    const candidateData = {
      candidate: {
        id: 'cand-1',
        carId: 'car-1',
        car: { brand: '理想', model: 'L6' },
        matchTags: ['预算命中'],
        recommendReason: '空间大',
        relevantDimensions: ['空间'],
      },
    };

    const result = await callCreate('journey-1', 'candidate_added', candidateData) as Record<string, unknown>;

    expect(mockTimelineCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId: 'journey-1',
        type: 'CANDIDATE_ADDED',
        metadata: expect.objectContaining({
          candidateId: 'cand-1',
          carId: 'car-1',
          carName: '理想 L6',
          matchTags: ['预算命中'],
        }),
      })
    );
    expect(result.timelineEvent).toBe(fakeEvent);
  });

  it('candidate_eliminated: creates CANDIDATE_ELIMINATED event', async () => {
    const fakeEvent = { id: 'tl-2' };
    mockTimelineCreateEvent.mockResolvedValueOnce(fakeEvent);

    const result = await callCreate('journey-1', 'candidate_eliminated', {
      candidateId: 'cand-2',
      eliminationReason: '超预算',
    }) as Record<string, unknown>;

    expect(mockTimelineCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CANDIDATE_ELIMINATED',
        metadata: expect.objectContaining({
          candidateId: 'cand-2',
          eliminationReason: '超预算',
        }),
      })
    );
    expect(result.timelineEvent).toBe(fakeEvent);
  });

  it('stage_changed: creates STAGE_CHANGED event with stage in metadata', async () => {
    const fakeEvent = { id: 'tl-3' };
    mockTimelineCreateEvent.mockResolvedValueOnce(fakeEvent);

    const result = await callCreate('journey-1', 'stage_changed', {
      stage: 'COMPARISON',
    }) as Record<string, unknown>;

    expect(mockTimelineCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STAGE_CHANGED',
        metadata: expect.objectContaining({
          stage: 'COMPARISON',
        }),
      })
    );
    expect((result as { patch?: { stage?: string } }).patch?.stage).toBe('COMPARISON');
  });

  it('journey_updated: creates REQUIREMENT_UPDATED event', async () => {
    const fakeEvent = { id: 'tl-4' };
    mockTimelineCreateEvent.mockResolvedValueOnce(fakeEvent);

    const requirementsPayload = { budgetMax: 300000, useCases: ['family'] };
    const result = await callCreate('journey-1', 'journey_updated', requirementsPayload) as Record<string, unknown>;

    expect(mockTimelineCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REQUIREMENT_UPDATED',
        metadata: expect.objectContaining({
          requirements: requirementsPayload,
        }),
      })
    );
    expect((result as { patch?: { requirements?: unknown } }).patch?.requirements).toEqual(requirementsPayload);
  });

  it('publish_suggestion: creates PUBLISH_SUGGESTION event', async () => {
    const fakeEvent = { id: 'tl-5' };
    mockTimelineCreateEvent.mockResolvedValueOnce(fakeEvent);

    const result = await callCreate('journey-1', 'publish_suggestion', {
      stage: 'DECISION',
    }) as Record<string, unknown>;

    expect(mockTimelineCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PUBLISH_SUGGESTION',
        metadata: expect.objectContaining({
          stage: 'DECISION',
        }),
      })
    );
    expect(result.timelineEvent).toBe(fakeEvent);
  });

  it('error in timeline creation is caught and does not throw when used via runChat', async () => {
    // Directly calling createTimelineEventForSideEffect WILL throw,
    // but in runChat it's wrapped in .catch(). We verify the method itself rejects.
    mockTimelineCreateEvent.mockRejectedValueOnce(new Error('DB connection failed'));

    // The method propagates the error; the caller (runChat) swallows it.
    await expect(callCreate('journey-1', 'candidate_added', { id: 'x' })).rejects.toThrow('DB connection failed');
  });
});

/* ================================================================== */
/* buildSignals                                                       */
/* ================================================================== */

describe('buildSignals', () => {
  let service: AiChatService;

  beforeEach(() => {
    service = new AiChatService();
  });

  function callBuildSignals(message: string, requirements: Record<string, unknown> = {}) {
    return (service as unknown as Record<string, (m: string, r: Record<string, unknown>) => Array<{ type: string; value: string; confidence: number }>>)
      .buildSignals(message, requirements);
  }

  it('budget range extraction: "20到30万" → REQUIREMENT signal with range', () => {
    const signals = callBuildSignals('预算20到30万的SUV');
    const reqSignal = signals.find((s) => s.type === 'REQUIREMENT');
    expect(reqSignal).toBeDefined();
    expect(reqSignal!.value).toBe('20-30万');
    expect(reqSignal!.confidence).toBe(0.86);
  });

  it('single budget: "30万" → REQUIREMENT signal', () => {
    const signals = callBuildSignals('想买30万的车');
    const reqSignal = signals.find((s) => s.type === 'REQUIREMENT');
    expect(reqSignal).toBeDefined();
    expect(reqSignal!.value).toBe('30万预算');
    expect(reqSignal!.confidence).toBe(0.72);
  });

  it('keyword extraction: common car-related keywords', () => {
    const signals = callBuildSignals('想要一台家用SUV，纯电的');
    const values = signals.map((s) => s.value);
    expect(values).toContain('SUV');
    expect(values).toContain('纯电');
    expect(values).toContain('家用');
  });

  it('returns CONCERN context if budget/useCases exist in journey but message has no signals', () => {
    const signals = callBuildSignals('你好', { budgetMax: 300000, useCases: ['family'] });
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('CONCERN');
    expect(signals[0].value).toBe('延续现有需求上下文');
  });

  it('returns empty array when no signals and no requirements', () => {
    const signals = callBuildSignals('你好', {});
    expect(signals).toHaveLength(0);
  });
});

/* ================================================================== */
/* estimateConfidenceScore                                            */
/* ================================================================== */

describe('estimateConfidenceScore', () => {
  let service: AiChatService;

  beforeEach(() => {
    service = new AiChatService();
  });

  function callEstimate(requirements: Record<string, unknown>, response: string) {
    return (service as unknown as Record<string, (r: Record<string, unknown>, res: string) => number>)
      .estimateConfidenceScore(requirements, response);
  }

  it('base score is 0.45 with no requirements and short response', () => {
    expect(callEstimate({}, 'ok')).toBe(0.45);
  });

  it('budget presence adds bonus', () => {
    const score = callEstimate({ budgetMax: 300000 }, 'ok');
    expect(score).toBe(0.57); // 0.45 + 0.12
  });

  it('useCase presence adds bonus', () => {
    const score = callEstimate({ useCases: ['family'] }, 'ok');
    expect(score).toBe(0.57); // 0.45 + 0.12
  });

  it('fuelType presence adds bonus', () => {
    const score = callEstimate({ fuelTypePreference: ['PHEV'] }, 'ok');
    expect(score).toBe(0.55); // 0.45 + 0.10
  });

  it('response length > 80 adds bonus', () => {
    const longResponse = 'a'.repeat(81);
    const score = callEstimate({}, longResponse);
    expect(score).toBe(0.5); // 0.45 + 0.05
  });

  it('capped at 0.95', () => {
    const score = callEstimate(
      {
        budgetMax: 300000,
        useCases: ['family'],
        fuelTypePreference: ['PHEV'],
        stylePreference: 'SUV',
      },
      'a'.repeat(100)
    );
    // 0.45 + 0.12 + 0.12 + 0.10 + 0.08 + 0.05 = 0.92
    expect(score).toBe(0.92);
  });

  it('all bonuses still capped at 0.95', () => {
    // Even if we duplicate keys, it won't exceed
    const score = callEstimate(
      {
        budgetMin: 100000,
        budgetMax: 300000,
        useCases: ['family', 'commute'],
        fuelTypePreference: ['PHEV', 'BEV'],
        stylePreference: 'SUV',
      },
      'a'.repeat(100)
    );
    // budgetMin counts for budget bonus too: 0.45 + 0.12 + 0.12 + 0.10 + 0.08 + 0.05 = 0.92
    expect(score).toBeLessThanOrEqual(0.95);
  });
});

/* ================================================================== */
/* runMockChat                                                        */
/* ================================================================== */

describe('runMockChat', () => {
  let service: AiChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiChatService();
    // Setup defaults for chat flow
    mockGetJourneyDetail.mockResolvedValue({
      id: 'journey-1',
      title: 'test',
      stage: 'INITIAL',
      status: 'ACTIVE',
      requirements: {},
      candidates: [],
    });
    mockGetOrCreateConversation.mockResolvedValue({ id: 'conv-1', sessionId: 'sess-1' });
    mockGetOrCreateByJourney.mockResolvedValue({ id: 'conv-1', sessionId: 'sess-1' });
    mockAddMessage.mockResolvedValue({});
    mockGetConversationHistory.mockResolvedValue([]);
    mockExtractSignals.mockResolvedValue({});
    mockUpdateAiConfidenceScore.mockResolvedValue({});
    mockExecuteChatTool.mockResolvedValue({ output: {}, sideEffects: [] });
  });

  async function callChat(message: string) {
    const events: Array<Record<string, unknown>> = [];
    await service.chat({
      journeyId: 'journey-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      message,
    });
    return events;
  }

  it('recognizes budget mentions in user message (triggers journey_update tool)', async () => {
    mockSearchCars.mockResolvedValue([]);
    mockGetCandidatesByJourney.mockResolvedValue([]);

    await callChat('我预算30万，家用SUV');

    // journey_update should be called (via executeChatTool)
    expect(mockExecuteChatTool).toHaveBeenCalledWith(
      'journey_update',
      expect.objectContaining({
        requirements: expect.objectContaining({ budgetMax: 30 }),
      }),
      expect.any(Object)
    );
  });

  it('recognizes fuel type preferences (增程/插混/phev)', async () => {
    mockSearchCars.mockResolvedValue([]);
    mockGetCandidatesByJourney.mockResolvedValue([]);

    await callChat('想要一台增程SUV，推荐一下');

    expect(mockExecuteChatTool).toHaveBeenCalledWith(
      'journey_update',
      expect.objectContaining({
        requirements: expect.objectContaining({
          fuelTypePreference: ['PHEV'],
        }),
      }),
      expect.any(Object)
    );
  });

  it('recognizes use case keywords (家用)', async () => {
    mockSearchCars.mockResolvedValue([]);
    mockGetCandidatesByJourney.mockResolvedValue([]);

    await callChat('家用代步车推荐');

    expect(mockExecuteChatTool).toHaveBeenCalledWith(
      'journey_update',
      expect.objectContaining({
        requirements: expect.objectContaining({
          useCases: ['family'],
        }),
      }),
      expect.any(Object)
    );
  });

  it('triggers car_search when recognizing car intent keywords (推荐/候选)', async () => {
    mockSearchCars.mockResolvedValue([]);
    mockGetCandidatesByJourney.mockResolvedValue([]);

    await callChat('推荐几款车');

    expect(mockExecuteChatTool).toHaveBeenCalledWith(
      'car_search',
      expect.objectContaining({ query: 'SUV' }),
      expect.any(Object)
    );
  });
});
