import { Candidate, JourneySnapshot, NotificationItem } from '@/types/api';

export const mockNotifications: NotificationItem[] = [
  {
    id: 'mock-notification-1',
    type: 'PRICE_DROP',
    title: '理想 L6 限时优惠',
    body: '本月下订立减 8000 元',
    isRead: false,
    createdAt: new Date('2026-03-23T10:24:00+08:00').toISOString(),
  },
  {
    id: 'mock-notification-2',
    type: 'NEW_REVIEW',
    title: '小鹏 G6 新增长续航版',
    body: 'CLTC 706km，售价 22.99 万',
    isRead: false,
    createdAt: new Date('2026-03-23T09:05:00+08:00').toISOString(),
  },
];

export const mockSnapshot: JourneySnapshot = {
  id: 'mock-snapshot-1',
  journeyId: 'mock-journey',
  narrativeSummary:
    '你的核心需求已趋于清晰：30万以内家用SUV，增程或混动优先，家庭出行+通勤兼顾。目前候选列表进入深度对比阶段。',
  keyInsights: [
    {
      insight: '价格敏感度高',
      evidence: '多次提及“30万以内”，对超预算方案快速排除',
      confidence: 0.91,
    },
    {
      insight: '续航焦虑中等',
      evidence: '询问过纯电续航，但最终更看重不限号政策',
      confidence: 0.74,
    },
  ],
  nextSuggestedActions: ['📊 查看用车成本对比', '🏪 预约试驾理想 L6', '💬 问问车主反馈'],
  generatedAt: new Date('2026-03-23T10:30:00+08:00').toISOString(),
};

export const mockCandidates: Candidate[] = [
  {
    id: 'mock-candidate-1',
    journeyId: 'mock-journey',
    carId: 'mock-car-1',
    status: 'ACTIVE',
    aiMatchScore: 0.92,
    priceAtAdd: 279800,
    userNotes: '符合家用通勤需求，增程不限号',
    car: {
      id: 'mock-car-1',
      brand: '理想',
      model: 'L6',
      variant: 'Max',
      type: 'SUV',
      fuelType: 'PHEV',
      msrp: 279800,
      baseSpecs: { seats: 5 },
    },
  },
  {
    id: 'mock-candidate-2',
    journeyId: 'mock-journey',
    carId: 'mock-car-2',
    status: 'ACTIVE',
    aiMatchScore: 0.85,
    priceAtAdd: 209900,
    userNotes: '城市通勤纯电首选，价格在预算内',
    car: {
      id: 'mock-car-2',
      brand: '小鹏',
      model: 'G6',
      variant: '长续航',
      type: 'SUV',
      fuelType: 'BEV',
      msrp: 209900,
      baseSpecs: { seats: 5 },
    },
  },
  {
    id: 'mock-candidate-3',
    journeyId: 'mock-journey',
    carId: 'mock-car-3',
    status: 'ELIMINATED',
    aiMatchScore: 0.68,
    priceAtAdd: 329800,
    eliminationReason: '已淘汰 · 超出 30 万预算',
    car: {
      id: 'mock-car-3',
      brand: '问界',
      model: 'M7',
      variant: '六座',
      type: 'SUV',
      fuelType: 'PHEV',
      msrp: 329800,
      baseSpecs: { seats: 6 },
    },
  },
];
