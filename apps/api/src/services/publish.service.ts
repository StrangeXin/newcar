import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { moderationService } from './moderation.service';
import { TIMELINE_EVENT_TYPES, buildTimelineEventContent, timelineService } from './timeline.service';

const VALID_FORMATS = ['story', 'report', 'template'];

type StoryTimeline = {
  stages: Array<{
    stage: string;
    headline: string;
    narrative: string;
    candidates?: string[];
    keyDimension?: string;
  }>;
};

type ReportData = {
  userProfile: {
    budget: string;
    fuelPreference: string;
    useCases: string[];
    coreDimensions: string[];
  };
  comparison: Array<{
    carName: string;
    scores: Record<string, number>;
    highlight: string;
  }>;
  recommendation: {
    carName: string;
    reasoning: string;
  };
};

type TemplateData = {
  dimensions: string[];
  weights: Record<string, number>;
  keyQuestions: string[];
  candidateCarIds: string[];
  candidateNames: string[];
  requirements?: Record<string, unknown>;
};

function clampScore(value: unknown) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class PublishService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  private buildCandidateName(candidate: any) {
    return [candidate?.car?.brand, candidate?.car?.model, candidate?.car?.variant].filter(Boolean).join(' ').trim();
  }

  private parseJsonBlock<T>(text: string, fallback: T): T {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return fallback;
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      return fallback;
    }
  }

  async generateStory(journey: any, latestSnapshot: any): Promise<StoryTimeline> {
    const client = this.getClient();

    const candidates = journey.candidates || [];
    const finalCandidate = candidates.find((c: any) => c.status === 'WINNER') || candidates.find((c: any) => c.status === 'ACTIVE');

    const candidateList = candidates
      .map((c: any) => {
        const label = c.status === 'WINNER' ? '（最终选择）' : c.status === 'ELIMINATED' ? '（已排除）' : '（候选中）';
        return `- ${this.buildCandidateName(c)}${label}`;
      })
      .join('\n');

    const prompt = `以下是用户的购车历程信息，请提炼成阶段叙事时间线。返回纯 JSON，不要输出任何解释。

购车历程标题：${journey.title}
购车阶段：${journey.stage}
AI 总结：${latestSnapshot?.narrativeSummary || '暂无'}
候选车型列表：
${candidateList || '暂无候选车型'}
${finalCandidate ? `最终选择：${this.buildCandidateName(finalCandidate)}` : ''}

要求：
1. stages 至少包含 3 个阶段，按时间推进
2. narrative 每段 50-150 字
3. headline 简短有概括性
4. candidates 填该阶段涉及车型
5. keyDimension 填该阶段最重要的关注点

JSON 结构：
{
  "stages": [
    {
      "stage": "AWARENESS",
      "headline": "开始明确需求",
      "narrative": "....",
      "candidates": ["理想 L6"],
      "keyDimension": "空间"
    }
  ]
}`;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        system: '你是一个擅长撰写真实购车经历故事的写手，帮助用户记录和分享他们的购车历程。',
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseJsonBlock<StoryTimeline>(text, {
        stages: [
          {
            stage: 'AWARENESS',
            headline: '明确购车方向',
            narrative: latestSnapshot?.narrativeSummary || '从需求澄清开始，逐步缩小车型范围。',
            candidates: candidates.slice(0, 2).map((candidate: any) => this.buildCandidateName(candidate)),
            keyDimension: candidates[0]?.relevantDimensions?.[0] || '预算',
          },
          {
            stage: journey.stage,
            headline: '收敛到最终选择',
            narrative: finalCandidate
              ? `在持续比较后，最终更倾向 ${this.buildCandidateName(finalCandidate)}，核心原因是它更贴近当前最在意的维度。`
              : '当前已经进入收敛阶段，开始从候选车中做取舍。',
            candidates: finalCandidate ? [this.buildCandidateName(finalCandidate)] : [],
            keyDimension: finalCandidate?.relevantDimensions?.[0] || '综合体验',
          },
        ],
      });
    } catch (err) {
      console.error('generateStory error:', err);
      return {
        stages: [
          {
            stage: 'AWARENESS',
            headline: '明确需求',
            narrative: latestSnapshot?.narrativeSummary || '逐步明确了预算、用途和偏好。',
            candidates: candidates.slice(0, 2).map((candidate: any) => this.buildCandidateName(candidate)),
            keyDimension: '预算',
          },
        ],
      };
    }
  }

  async generateReport(journey: any, candidates: any[]): Promise<ReportData> {
    const client = this.getClient();
    const requirements = (journey.requirements as any) || {};

    const candidateList = candidates
      .map((c: any) => {
        const car = c.car;
        return `${car.brand} ${car.model} ${car.variant}（${car.fuelType}，指导价 ${car.msrp ? (car.msrp / 10000).toFixed(1) + ' 万' : '未知'}）`;
      })
      .join('\n');

    const prompt = `根据以下购车历程数据，生成一份结构化购车决策报告。请返回纯 JSON，不要有额外文字。

用户需求：
- 预算范围：${requirements.budgetMin || '未设定'} - ${requirements.budgetMax || '未设定'} 万
- 用车场景：${(requirements.useCases || []).join('、') || '未设定'}
- 燃料偏好：${(requirements.fuelTypePreference || []).join('、') || '未设定'}

候选车型：
${candidateList || '暂无'}

请返回以下结构的 JSON：
{
  "userProfile": {
    "budget": "预算描述",
    "useCases": ["场景1", "场景2"],
    "fuelPreference": "燃料偏好",
    "coreDimensions": ["空间", "续航"]
  },
  "comparison": [
    {
      "carName": "品牌 车型 版本",
      "scores": {
        "价格": 0-100,
        "空间": 0-100
      },
      "highlight": "一句话亮点"
    }
  ],
  "recommendation": {
    "carName": "最终推荐车型名称",
    "reasoning": "推荐理由"
  }
}`;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        system: '你是一位专业的购车顾问，擅长数据分析和决策报告撰写。',
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      return this.parseJsonBlock<ReportData>(text, {
        userProfile: {
          budget: `${requirements.budgetMin || '未设定'}-${requirements.budgetMax || '未设定'}万`,
          fuelPreference: (requirements.fuelTypePreference || []).join('、') || '未设定',
          useCases: requirements.useCases || [],
          coreDimensions: candidates.flatMap((candidate: any) => candidate.relevantDimensions || []).slice(0, 4),
        },
        comparison: candidates.map((candidate: any) => ({
          carName: this.buildCandidateName(candidate),
          scores: {
            价格: clampScore(100 - ((candidate.car?.msrp || 0) / 10000)),
            空间: clampScore(candidate.car?.type === 'SUV' ? 85 : 65),
            续航: clampScore(candidate.car?.baseSpecs?.range || 70),
          },
          highlight: candidate.recommendReason || `${this.buildCandidateName(candidate)} 在当前候选中有清晰优势。`,
        })),
        recommendation: {
          carName: this.buildCandidateName(candidates[0]),
          reasoning: candidates[0]?.recommendReason || '综合预算、用途和体验后，是当前更平衡的选择。',
        },
      });
    } catch (err) {
      console.error('generateReport error:', err);
      return {
        userProfile: {
          budget: `${requirements.budgetMin || '未设定'}-${requirements.budgetMax || '未设定'}万`,
          fuelPreference: (requirements.fuelTypePreference || []).join('、') || '未设定',
          useCases: requirements.useCases || [],
          coreDimensions: candidates.flatMap((candidate: any) => candidate.relevantDimensions || []).slice(0, 4),
        },
        comparison: [],
        recommendation: {
          carName: '',
          reasoning: '暂无推荐理由',
        },
      };
    }
  }

  async generateTemplate(journey: any, candidates: any[]): Promise<TemplateData> {
    const client = this.getClient();

    const activeCandidates = candidates.filter((c: any) => c.status === 'ACTIVE' || c.status === 'WINNER');
    const candidateCarIds = activeCandidates.map((c: any) => c.carId);
    const candidateNames = activeCandidates.map((c: any) => this.buildCandidateName(c));

    const candidateList = candidates
      .map((c: any) => {
        const car = c.car;
        return `${car.brand} ${car.model} ${car.variant}（${car.fuelType}，${car.type}）`;
      })
      .join('\n');

    const prompt = `根据以下购车历程，提取可复用的购车决策框架（不含个人主观判断）。请返回纯 JSON。

购车背景：${journey.title}
候选车型：
${candidateList || '暂无'}

请返回以下结构的 JSON：
{
  "dimensions": ["对比维度1", "对比维度2"],
  "weights": {
    "维度1": 0.0-1.0,
    "维度2": 0.0-1.0
  },
  "keyQuestions": ["选购前必问问题1", "选购前必问问题2"]
}`;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 1024,
        system: '你是一位购车决策专家，帮助提炼可复用的选车方法论。',
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          candidateCarIds,
          candidateNames,
          requirements: asObject(journey.requirements),
        };
      }
      return { dimensions: [], weights: {}, candidateCarIds, candidateNames, keyQuestions: [], requirements: asObject(journey.requirements) };
    } catch (err) {
      console.error('generateTemplate error:', err);
      return { dimensions: [], weights: {}, candidateCarIds, candidateNames, keyQuestions: [], requirements: asObject(journey.requirements) };
    }
  }

  async generatePublishSummary(journey: any, candidates: any[], latestSnapshot: any): Promise<string> {
    const client = this.getClient();
    const winner = candidates.find((candidate: any) => candidate.status === 'WINNER') || candidates[0];
    const fallback = winner
      ? `${journey.title}，最终因为${winner.recommendReason || '更匹配核心需求'}选择了${this.buildCandidateName(winner)}`
      : latestSnapshot?.narrativeSummary?.slice(0, 50) || journey.title;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 120,
        system: '你是一个擅长写简洁决策摘要的编辑。输出一句 50 字以内中文摘要，不要引号，不要解释。',
        messages: [
          {
            role: 'user',
            content: `标题：${journey.title}\n候选车：${candidates.map((candidate: any) => this.buildCandidateName(candidate)).join('、')}\n摘要：${latestSnapshot?.narrativeSummary || ''}\n最终更倾向：${winner ? this.buildCandidateName(winner) : '未定'}\n请输出一句 50 字以内的决策摘要。`,
          },
        ],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : fallback;
      return text || fallback;
    } catch {
      return fallback;
    }
  }

  async publishJourney(
    journeyId: string,
    options: {
      title: string;
      description?: string;
      publishedFormats: string[];
      visibility: string;
    }
  ) {
    const { title, description, publishedFormats, visibility } = options;

    if (!publishedFormats || publishedFormats.length === 0) {
      throw new Error('publishedFormats must include at least one format');
    }
    const invalidFormats = publishedFormats.filter((f) => !VALID_FORMATS.includes(String(f).toLowerCase()));
    if (invalidFormats.length > 0) {
      throw new Error(`Invalid publishedFormats: ${invalidFormats.join(', ')}`);
    }

    // 1. 查询 Journey（含 candidates、snapshots、user）
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        candidates: { include: { car: true } },
        snapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
        user: true,
      },
    });

    // 2. 验证
    if (!journey) {
      throw new Error('Journey not found');
    }

    const latestSnapshot = journey.snapshots[0] || null;
    const candidates = journey.candidates;

    // 4. 并行生成内容
    const contentGenerations: Promise<any>[] = [];
    const formatKeys = publishedFormats.map((f) => f.toLowerCase());

    const storyPromise = formatKeys.includes('story')
      ? this.generateStory(journey, latestSnapshot)
      : Promise.resolve(null);
    const reportPromise = formatKeys.includes('report')
      ? this.generateReport(journey, candidates)
      : Promise.resolve(null);
    const templatePromise = formatKeys.includes('template')
      ? this.generateTemplate(journey, candidates)
      : Promise.resolve(null);

    contentGenerations.push(storyPromise, reportPromise, templatePromise);
    const [storyContent, reportData, templateData, publishSummary] = await Promise.all([
      ...contentGenerations,
      this.generatePublishSummary(journey, candidates, latestSnapshot),
    ]);

    // 5. 合并内容审核
    const contentForReview = [
      title,
      description || '',
      typeof publishSummary === 'string' ? publishSummary : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const reviewResult = await moderationService.preReview(contentForReview);

    // 7. 构建 tags
    const requirements = (journey.requirements as any) || {};
    const fuelTypes = [...new Set(candidates.map((c: any) => c.car?.fuelType).filter(Boolean))];
    const tags = {
      carIds: candidates.map((c: any) => c.carId),
      candidateNames: candidates.map((c: any) => this.buildCandidateName(c)),
      budgetMin: requirements.budgetMin,
      budgetMax: requirements.budgetMax,
      useCases: requirements.useCases || [],
      fuelType: fuelTypes,
    };

    const contentStatus = reviewResult.passed ? 'LIVE' : 'PENDING_REVIEW';

    // 3 & 6. 检查是否已发布（upsert）
    const existing = await prisma.publishedJourney.findUnique({
      where: { journeyId },
    });

    let result;
    if (existing) {
      const updateData: any = {
        title,
        description,
        publishSummary,
        publishedFormats: formatKeys,
        tags,
        storyContent: storyContent ? JSON.stringify(storyContent) : existing.storyContent,
        reportData: reportData ?? existing.reportData,
        templateData: templateData ?? existing.templateData,
        visibility,
        contentStatus,
        contentVersion: existing.contentVersion + 1,
        lastSyncedAt: new Date(),
      };
      result = await prisma.publishedJourney.update({
        where: { journeyId },
        data: updateData,
      });
    } else {
      const createData: any = {
        journeyId,
        userId: journey.userId,
        title,
        description,
        publishSummary,
        publishedFormats: formatKeys,
        tags,
        storyContent: storyContent ? JSON.stringify(storyContent) : null,
        reportData: reportData ?? null,
        templateData: templateData ?? null,
        visibility,
        contentStatus,
        lastSyncedAt: new Date(),
      };
      result = await prisma.publishedJourney.create({
        data: createData,
      });
    }

    await timelineService.createEvent({
      journeyId,
      type: TIMELINE_EVENT_TYPES.JOURNEY_PUBLISHED,
      content: buildTimelineEventContent(TIMELINE_EVENT_TYPES.JOURNEY_PUBLISHED, {
        title,
        publishSummary,
      }),
      metadata: {
        publishedJourneyId: result.id,
        title,
        publishSummary,
      },
    });

    return result;
  }

  async previewPublish(journeyId: string, publishedFormats: string[]): Promise<object> {
    if (!publishedFormats || publishedFormats.length === 0) {
      throw new Error('publishedFormats must include at least one format');
    }
    const invalidFormats = publishedFormats.filter((f) => !VALID_FORMATS.includes(String(f).toLowerCase()));
    if (invalidFormats.length > 0) {
      throw new Error(`Invalid publishedFormats: ${invalidFormats.join(', ')}`);
    }

    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      include: {
        candidates: { include: { car: true } },
        snapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    });

    if (!journey) {
      throw new Error('Journey not found');
    }

    const latestSnapshot = journey.snapshots[0] || null;
    const candidates = journey.candidates;
    const formatKeys = publishedFormats.map((f) => f.toLowerCase());

    const [storyContent, reportData, templateData] = await Promise.all([
      formatKeys.includes('story') ? this.generateStory(journey, latestSnapshot) : Promise.resolve(null),
      formatKeys.includes('report') ? this.generateReport(journey, candidates) : Promise.resolve(null),
      formatKeys.includes('template') ? this.generateTemplate(journey, candidates) : Promise.resolve(null),
    ]);

    return {
      journeyId,
      formats: formatKeys,
      storyContent,
      reportData,
      templateData,
      preview: true,
    };
  }
}

export const publishService = new PublishService();
