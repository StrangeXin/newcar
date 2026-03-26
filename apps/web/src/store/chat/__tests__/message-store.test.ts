import { describe, it, expect } from 'vitest';
import {
  makeId,
  parseToolInput,
  isRecord,
  isTimelineEvent,
  mapTimelineEventTypeToSideEffect,
  parseCarResults,
} from '../message-store';
import type {
  ChatRole,
  ToolName,
  TextChatMessage,
  ToolChatMessage,
  SideEffectEvent,
  CarResultChatMessage,
  ChatMessage,
} from '../message-store';

/* ── Type definitions ────────────────────────────────────────────── */

describe('type definitions', () => {
  it('ChatRole accepts USER and ASSISTANT', () => {
    const user: ChatRole = 'USER';
    const assistant: ChatRole = 'ASSISTANT';
    expect(user).toBe('USER');
    expect(assistant).toBe('ASSISTANT');
  });

  it('ToolName accepts all tool variants', () => {
    const tools: ToolName[] = ['car_search', 'car_detail', 'journey_update', 'add_candidate'];
    expect(tools).toHaveLength(4);
  });

  it('TextChatMessage has required shape', () => {
    const msg: TextChatMessage = {
      id: 'msg-1',
      timestamp: new Date().toISOString(),
      kind: 'text',
      role: 'USER',
      content: 'Hello',
    };
    expect(msg.kind).toBe('text');
    expect(msg.role).toBe('USER');
  });

  it('ToolChatMessage has required shape', () => {
    const msg: ToolChatMessage = {
      id: 'tool-1',
      timestamp: new Date().toISOString(),
      kind: 'tool_status',
      name: 'car_search',
      input: { query: 'SUV' },
      status: 'running',
    };
    expect(msg.kind).toBe('tool_status');
    expect(msg.status).toBe('running');
  });

  it('ChatMessage is a union of all message kinds', () => {
    const msgs: ChatMessage[] = [
      { id: '1', timestamp: '', kind: 'text', role: 'USER', content: 'hi' },
      { id: '2', timestamp: '', kind: 'tool_status', name: 'car_search', input: {}, status: 'done' },
      { id: '3', timestamp: '', kind: 'side_effect', event: 'candidate_added', data: {} },
      { id: '4', timestamp: '', kind: 'car_results', journeyId: 'j1', cars: [] },
    ];
    expect(msgs).toHaveLength(4);
  });
});

/* ── makeId ──────────────────────────────────────────────────────── */

describe('makeId', () => {
  it('generates id with given prefix', () => {
    const id = makeId('msg');
    expect(id).toMatch(/^msg-/);
  });

  it('generates unique ids on each call', () => {
    const ids = Array.from({ length: 20 }, () => makeId('x'));
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  it('uses the exact prefix provided', () => {
    const id = makeId('tool_status');
    expect(id.startsWith('tool_status-')).toBe(true);
  });

  it('appended part after prefix looks like a UUID', () => {
    const id = makeId('prefix');
    const suffix = id.slice('prefix-'.length);
    // UUID v4 pattern: 8-4-4-4-12 hex chars
    expect(suffix).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

/* ── parseToolInput ──────────────────────────────────────────────── */

describe('parseToolInput', () => {
  it('returns the input object when given a plain object', () => {
    const input = { key: 'value' };
    expect(parseToolInput(input)).toBe(input);
  });

  it('returns empty object for null', () => {
    expect(parseToolInput(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(parseToolInput(undefined)).toEqual({});
  });

  it('returns empty object for a string', () => {
    expect(parseToolInput('{"key":"value"}')).toEqual({});
  });

  it('returns empty object for a number', () => {
    expect(parseToolInput(42)).toEqual({});
  });

  it('returns empty object for false', () => {
    expect(parseToolInput(false)).toEqual({});
  });

  it('returns the input object for an array (it is an object)', () => {
    // parseToolInput checks `typeof input === 'object'`; arrays pass that check
    const arr = [1, 2, 3];
    expect(parseToolInput(arr)).toBe(arr);
  });
});

/* ── isRecord ────────────────────────────────────────────────────── */

describe('isRecord', () => {
  it('returns true for a plain object', () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('returns true for empty object', () => {
    expect(isRecord({})).toBe(true);
  });

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isRecord([1, 2])).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isRecord('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isRecord(123)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isRecord(undefined)).toBe(false);
  });
});

/* ── isTimelineEvent ─────────────────────────────────────────────── */

describe('isTimelineEvent', () => {
  const valid = {
    id: 'te-1',
    journeyId: 'j-1',
    type: 'CANDIDATE_ADDED',
    content: 'Car added',
    createdAt: '2026-01-01T00:00:00Z',
    metadata: {},
  };

  it('returns true for a valid timeline event', () => {
    expect(isTimelineEvent(valid)).toBe(true);
  });

  it('returns false when id is missing', () => {
    const { id: _id, ...rest } = valid;
    expect(isTimelineEvent(rest)).toBe(false);
  });

  it('returns false when journeyId is missing', () => {
    const { journeyId: _jid, ...rest } = valid;
    expect(isTimelineEvent(rest)).toBe(false);
  });

  it('returns false when type is not a string', () => {
    expect(isTimelineEvent({ ...valid, type: 123 })).toBe(false);
  });

  it('returns false when content is missing', () => {
    const { content: _c, ...rest } = valid;
    expect(isTimelineEvent(rest)).toBe(false);
  });

  it('returns false when createdAt is missing', () => {
    const { createdAt: _ca, ...rest } = valid;
    expect(isTimelineEvent(rest)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTimelineEvent(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isTimelineEvent([])).toBe(false);
  });
});

/* ── mapTimelineEventTypeToSideEffect ────────────────────────────── */

describe('mapTimelineEventTypeToSideEffect', () => {
  it('maps CANDIDATE_ADDED → candidate_added', () => {
    expect(mapTimelineEventTypeToSideEffect('CANDIDATE_ADDED')).toBe('candidate_added');
  });

  it('maps CANDIDATE_ELIMINATED → candidate_eliminated', () => {
    expect(mapTimelineEventTypeToSideEffect('CANDIDATE_ELIMINATED')).toBe('candidate_eliminated');
  });

  it('maps CANDIDATE_WINNER → candidate_winner', () => {
    expect(mapTimelineEventTypeToSideEffect('CANDIDATE_WINNER')).toBe('candidate_winner');
  });

  it('maps STAGE_CHANGED → stage_changed', () => {
    expect(mapTimelineEventTypeToSideEffect('STAGE_CHANGED')).toBe('stage_changed');
  });

  it('maps REQUIREMENT_UPDATED → journey_updated', () => {
    expect(mapTimelineEventTypeToSideEffect('REQUIREMENT_UPDATED')).toBe('journey_updated');
  });

  it('maps AI_INSIGHT → ai_insight', () => {
    expect(mapTimelineEventTypeToSideEffect('AI_INSIGHT')).toBe('ai_insight');
  });

  it('maps PRICE_CHANGE → journey_updated', () => {
    expect(mapTimelineEventTypeToSideEffect('PRICE_CHANGE')).toBe('journey_updated');
  });

  it('maps USER_ACTION → journey_updated', () => {
    expect(mapTimelineEventTypeToSideEffect('USER_ACTION')).toBe('journey_updated');
  });

  it('maps PUBLISH_SUGGESTION → publish_suggestion', () => {
    expect(mapTimelineEventTypeToSideEffect('PUBLISH_SUGGESTION')).toBe('publish_suggestion');
  });

  it('maps JOURNEY_PUBLISHED → journey_published', () => {
    expect(mapTimelineEventTypeToSideEffect('JOURNEY_PUBLISHED')).toBe('journey_published');
  });

  it('returns timeline_event for an unknown type via default branch', () => {
    // Cast to bypass TypeScript so we can exercise the default branch at runtime
    const result = mapTimelineEventTypeToSideEffect('UNKNOWN_TYPE' as never);
    expect(result).toBe('timeline_event');
  });

  it('all known event types map to a valid SideEffectEvent', () => {
    const validSideEffects: SideEffectEvent[] = [
      'candidate_added', 'candidate_eliminated', 'candidate_winner',
      'journey_updated', 'stage_changed', 'ai_insight',
      'publish_suggestion', 'journey_published', 'timeline_event',
    ];

    const knownTypes = [
      'CANDIDATE_ADDED', 'CANDIDATE_ELIMINATED', 'CANDIDATE_WINNER',
      'STAGE_CHANGED', 'REQUIREMENT_UPDATED', 'AI_INSIGHT',
      'PRICE_CHANGE', 'USER_ACTION', 'PUBLISH_SUGGESTION', 'JOURNEY_PUBLISHED',
    ] as const;

    for (const type of knownTypes) {
      const mapped = mapTimelineEventTypeToSideEffect(type);
      expect(validSideEffects).toContain(mapped);
    }
  });
});

/* ── parseCarResults ─────────────────────────────────────────────── */

describe('parseCarResults', () => {
  const rawCars = [
    { id: 'c1', brand: 'Tesla', model: 'Model 3', type: 'Sedan', fuelType: 'BEV', msrp: 250000 },
    { id: 'c2', brand: 'Li', model: 'L9', type: 'SUV', fuelType: 'PHEV', msrp: 459900 },
    { id: 'c3', brand: 'NIO', model: 'ES6', type: 'SUV', fuelType: 'BEV', msrp: 368000 },
  ];

  it('returns empty array for null', () => {
    expect(parseCarResults(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseCarResults(undefined)).toEqual([]);
  });

  it('returns empty array when there is no cars key', () => {
    expect(parseCarResults({ data: [] })).toEqual([]);
  });

  it('returns empty array when cars is not an array', () => {
    expect(parseCarResults({ cars: 'not-an-array' })).toEqual([]);
  });

  it('returns empty array for an empty cars array', () => {
    expect(parseCarResults({ cars: [] })).toEqual([]);
  });

  it('maps each car to the expected shape', () => {
    const results = parseCarResults({ cars: rawCars });
    expect(results).toHaveLength(3);

    const first = results[0];
    expect(first.id).toBe('c1');
    expect(first.brand).toBe('Tesla');
    expect(first.model).toBe('Model 3');
    expect(first.type).toBe('Sedan');
    expect(first.fuelType).toBe('BEV');
    expect(first.msrp).toBe(250000);
  });

  it('assigns matchScores 92, 85, 73 for the first three cars', () => {
    const results = parseCarResults({ cars: rawCars });
    expect(results[0].matchScore).toBe(92);
    expect(results[1].matchScore).toBe(85);
    expect(results[2].matchScore).toBe(73);
  });

  it('assigns fallback matchScore 68 for cars beyond index 2', () => {
    const fourCars = [...rawCars, { id: 'c4', brand: 'X', model: 'Y', type: 'Z', fuelType: 'BEV', msrp: 100000 }];
    const results = parseCarResults({ cars: fourCars });
    expect(results[3].matchScore).toBe(68);
  });

  it('generates subtitle with 纯电 for BEV fuelType', () => {
    const results = parseCarResults({ cars: [rawCars[0]] });
    expect(results[0].subtitle).toContain('纯电');
  });

  it('generates subtitle with 增程 for PHEV fuelType', () => {
    const results = parseCarResults({ cars: [rawCars[1]] });
    expect(results[0].subtitle).toContain('增程');
  });

  it('includes formatted price in subtitle', () => {
    const results = parseCarResults({ cars: [rawCars[0]] });
    // 250000 / 10000 = 25.00 万
    expect(results[0].subtitle).toContain('25.00万起');
  });

  it('shows 暂无价格 in subtitle when msrp is not a number', () => {
    const car = { id: 'cx', brand: 'X', model: 'Y', type: 'Z', fuelType: 'BEV', msrp: 'unknown' };
    const results = parseCarResults({ cars: [car] });
    expect(results[0].subtitle).toContain('暂无价格');
  });

  it('sets msrp to null when value is not a number', () => {
    const car = { id: 'cx', brand: 'X', model: 'Y', type: 'Z', fuelType: 'BEV', msrp: null };
    const results = parseCarResults({ cars: [car] });
    expect(results[0].msrp).toBeNull();
  });

  it('subtitle is undefined when fuelType is not a string', () => {
    const car = { id: 'cx', brand: 'X', model: 'Y', type: 'Z', fuelType: 123, msrp: 100000 };
    const results = parseCarResults({ cars: [car] });
    expect(results[0].subtitle).toBeUndefined();
  });

  it('return type matches CarResultChatMessage["cars"] element shape', () => {
    const results: CarResultChatMessage['cars'] = parseCarResults({ cars: rawCars });
    expect(results.length).toBeGreaterThan(0);
  });
});
