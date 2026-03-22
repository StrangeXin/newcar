import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { moderationService } from './moderation.service';

const VALID_FORMATS = ['story', 'report', 'template'];

export class PublishService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async generateStory(journey: any, latestSnapshot: any): Promise<string> {
    const client = this.getClient();

    const candidates = journey.candidates || [];
    const activeCandidates = candidates.filter((c: any) => c.status === 'ACTIVE');
    const finalCandidate = candidates.find((c: any) => c.status === 'SELECTED') || activeCandidates[0];

    const candidateList = candidates
      .map((c: any) => {
        const car = c.car;
        const label = c.status === 'SELECTED' ? '（最终选择）' : c.status === 'ELIMINATED' ? '（已排除）' : '（候选中）';
        return `- ${car.brand} ${car.model} ${car.variant}${label}：${car.msrp ? `指导价 ${(car.msrp / 10000).toFixed(1)} 万` : '价格未知'}，${car.fuelType}`;
      })
      .join('\n');

    const prompt = `以下是用户的购车历程信息，请帮助生成一篇真实、有温度的第一人称购车叙事文章（500-1000字）。

购车历程标题：${journey.title}
购车阶段：${journey.stage}
AI 总结：${latestSnapshot?.narrativeSummary || '暂无'}
候选车型列表：
${candidateList || '暂无候选车型'}
${finalCandidate ? `最终选择：${finalCandidate.car.brand} ${finalCandidate.car.model} ${finalCandidate.car.variant}` : ''}

要求：
1. 第一人称写作，有情感弧线
2. 包含纠结过程和最终决策原因
3. 真实自然，不超过 1000 字
4. 不要任何广告或推广内容`;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        system: '你是一个擅长撰写真实购车经历故事的写手，帮助用户记录和分享他们的购车历程。',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      console.error('generateStory error:', err);
      return '';
    }
  }

  async generateReport(journey: any, candidates: any[]): Promise<object> {
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
    "fuelPreference": "燃料偏好"
  },
  "comparisonMatrix": [
    {
      "carName": "品牌 车型 版本",
      "scores": {
        "price": 0.0-1.0,
        "space": 0.0-1.0,
        "performance": 0.0-1.0,
        "value": 0.0-1.0
      }
    }
  ],
  "decisionConfidence": 0.0-1.0,
  "finalRecommendation": "最终推荐车型名称",
  "reasoning": "推荐理由"
}`;

    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: 2048,
        system: '你是一位专业的购车顾问，擅长数据分析和决策报告撰写。',
        messages: [{ role: 'user', content: prompt }],
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (err) {
      console.error('generateReport error:', err);
      return {};
    }
  }

  async generateTemplate(journey: any, candidates: any[]): Promise<object> {
    const client = this.getClient();

    const activeCandidates = candidates.filter((c: any) => c.status === 'ACTIVE' || c.status === 'SELECTED');
    const candidateCarIds = activeCandidates.map((c: any) => c.carId);

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
        };
      }
      return { dimensions: [], weights: {}, candidateCarIds, keyQuestions: [] };
    } catch (err) {
      console.error('generateTemplate error:', err);
      return { dimensions: [], weights: {}, candidateCarIds, keyQuestions: [] };
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
    const [storyContent, reportData, templateData] = await Promise.all(contentGenerations);

    // 5. 合并内容审核
    const contentForReview = [
      title,
      description || '',
      typeof storyContent === 'string' ? storyContent : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const reviewResult = await moderationService.preReview(contentForReview);

    // 7. 构建 tags
    const requirements = (journey.requirements as any) || {};
    const fuelTypes = [...new Set(candidates.map((c: any) => c.car?.fuelType).filter(Boolean))];
    const tags = {
      carIds: candidates.map((c: any) => c.carId),
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
      result = await prisma.publishedJourney.update({
        where: { journeyId },
        data: {
          title,
          description,
          publishedFormats: formatKeys,
          tags,
          storyContent: storyContent ?? existing.storyContent,
          reportData: reportData ?? existing.reportData,
          templateData: templateData ?? existing.templateData,
          visibility,
          contentStatus,
          contentVersion: existing.contentVersion + 1,
          lastSyncedAt: new Date(),
        },
      });
    } else {
      result = await prisma.publishedJourney.create({
        data: {
          journeyId,
          userId: journey.userId,
          title,
          description,
          publishedFormats: formatKeys,
          tags,
          storyContent: storyContent ?? null,
          reportData: reportData ?? null,
          templateData: templateData ?? null,
          visibility,
          contentStatus,
          lastSyncedAt: new Date(),
        },
      });
    }

    return result;
  }

  async previewPublish(journeyId: string, publishedFormats: string[]): Promise<object> {
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
