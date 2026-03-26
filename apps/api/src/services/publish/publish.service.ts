import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { moderationService } from '../moderation.service';
import { TIMELINE_EVENT_TYPES, buildTimelineEventContent, timelineService } from '../timeline.service';
import { contentGenerator } from './content-generator';

type CandidateWithCar = Prisma.CarCandidateGetPayload<{
  include: { car: true };
}>;

interface Requirements {
  budgetMin?: number;
  budgetMax?: number;
  useCases?: string[];
  fuelTypePreference?: string[];
  [key: string]: unknown;
}

const VALID_FORMATS = ['story', 'report', 'template'];

export class PublishService {
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
    const formatKeys = publishedFormats.map((f) => f.toLowerCase());

    const [storyContent, reportData, templateData, publishSummary] = await Promise.all([
      formatKeys.includes('story') ? contentGenerator.generateStory(journey, latestSnapshot) : Promise.resolve(null),
      formatKeys.includes('report') ? contentGenerator.generateReport(journey, candidates) : Promise.resolve(null),
      formatKeys.includes('template') ? contentGenerator.generateTemplate(journey, candidates) : Promise.resolve(null),
      contentGenerator.generatePublishSummary(journey, candidates, latestSnapshot),
    ] as const);

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
    const requirements = (journey.requirements as Requirements) || {};
    const fuelTypes = [...new Set(candidates.map((c) => c.car?.fuelType).filter(Boolean))];
    const tags = {
      carIds: candidates.map((c) => c.carId),
      candidateNames: candidates.map((c) => contentGenerator.buildCandidateName(c)),
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
      const updateData: Prisma.PublishedJourneyUpdateInput = {
        title,
        description,
        publishSummary,
        publishedFormats: formatKeys,
        tags,
        storyContent: storyContent ? JSON.stringify(storyContent) : existing.storyContent,
        reportData: reportData
          ? (reportData as unknown as Prisma.InputJsonValue)
          : existing.reportData ?? Prisma.JsonNull,
        templateData: templateData
          ? (templateData as unknown as Prisma.InputJsonValue)
          : existing.templateData ?? Prisma.JsonNull,
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
      const createData: Prisma.PublishedJourneyUncheckedCreateInput = {
        journeyId,
        userId: journey.userId,
        title,
        description,
        publishSummary,
        publishedFormats: formatKeys,
        tags,
        storyContent: storyContent ? JSON.stringify(storyContent) : null,
        reportData: reportData ? (reportData as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        templateData: templateData ? (templateData as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
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

  async regeneratePublishedContent(
    publishedJourneyId: string,
    format: 'story' | 'report' | 'template' | 'summary'
  ) {
    const published = await prisma.publishedJourney.findUnique({
      where: { id: publishedJourneyId },
      include: {
        journey: {
          include: {
            candidates: { include: { car: true } },
            snapshots: { orderBy: { generatedAt: 'desc' }, take: 1 },
            user: true,
          },
        },
      },
    });

    if (!published || !published.journey) {
      throw new Error('Published journey not found');
    }

    const journey = published.journey;
    const latestSnapshot = journey.snapshots?.[0] || null;
    const candidates = journey.candidates || [];

    if (format === 'story') {
      const storyContent = await contentGenerator.generateStory(journey, latestSnapshot);
      return prisma.publishedJourney.update({
        where: { id: publishedJourneyId },
        data: {
          storyContent: JSON.stringify(storyContent),
          lastSyncedAt: new Date(),
        },
      });
    }

    if (format === 'report') {
      const reportData = await contentGenerator.generateReport(journey, candidates);
      return prisma.publishedJourney.update({
        where: { id: publishedJourneyId },
        data: {
          reportData: reportData as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      });
    }

    if (format === 'template') {
      const templateData = await contentGenerator.generateTemplate(journey, candidates);
      return prisma.publishedJourney.update({
        where: { id: publishedJourneyId },
        data: {
          templateData: templateData as unknown as Prisma.InputJsonValue,
          lastSyncedAt: new Date(),
        },
      });
    }

    const publishSummary = await contentGenerator.generatePublishSummary(journey, candidates, latestSnapshot);
    return prisma.publishedJourney.update({
      where: { id: publishedJourneyId },
      data: {
        publishSummary,
        lastSyncedAt: new Date(),
      },
    });
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
      formatKeys.includes('story') ? contentGenerator.generateStory(journey, latestSnapshot) : Promise.resolve(null),
      formatKeys.includes('report') ? contentGenerator.generateReport(journey, candidates) : Promise.resolve(null),
      formatKeys.includes('template') ? contentGenerator.generateTemplate(journey, candidates) : Promise.resolve(null),
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
