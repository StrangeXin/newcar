import { prisma } from '../lib/prisma';

interface ListCommunityParams {
  carIds?: string[];
  budgetMin?: number;
  budgetMax?: number;
  fuelType?: string;
  useCases?: string[];
  result?: 'purchased' | 'in_progress';
  hasTemplate?: boolean;
  sort?: 'relevance' | 'latest' | 'popular';
  limit?: number;
  offset?: number;
}

interface JourneyRequirements {
  budgetMin?: number;
  budgetMax?: number;
  fuelTypePreference?: string[];
  useCases?: string[];
}

function toObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function toRequirements(input: unknown): JourneyRequirements {
  const value = toObject(input);
  return {
    budgetMin: typeof value.budgetMin === 'number' ? value.budgetMin : undefined,
    budgetMax: typeof value.budgetMax === 'number' ? value.budgetMax : undefined,
    fuelTypePreference: Array.isArray(value.fuelTypePreference)
      ? value.fuelTypePreference.map(String)
      : undefined,
    useCases: Array.isArray(value.useCases) ? value.useCases.map(String) : undefined,
  };
}

export class CommunityService {
  calcRelevanceBoost(
    viewerReq: JourneyRequirements | null | undefined,
    postTags: Record<string, unknown>
  ): number {
    if (!viewerReq) {
      return 1;
    }

    const tags = toObject(postTags);

    const viewerBudgetMin = viewerReq.budgetMin;
    const viewerBudgetMax = viewerReq.budgetMax;
    const postBudgetMin = typeof tags.budgetMin === 'number' ? tags.budgetMin : undefined;
    const postBudgetMax = typeof tags.budgetMax === 'number' ? tags.budgetMax : undefined;
    const budgetOverlap =
      viewerBudgetMin !== undefined &&
      viewerBudgetMax !== undefined &&
      postBudgetMin !== undefined &&
      postBudgetMax !== undefined &&
      Math.max(viewerBudgetMin, postBudgetMin) <= Math.min(viewerBudgetMax, postBudgetMax)
        ? 1
        : 0;

    const viewerUseCases = viewerReq.useCases || [];
    const postUseCases = Array.isArray(tags.useCases) ? tags.useCases.map(String) : [];
    const useCaseIntersection = viewerUseCases.filter((item) => postUseCases.includes(item)).length;
    const useCaseOverlap =
      viewerUseCases.length > 0 ? useCaseIntersection / viewerUseCases.length : 0;

    const viewerFuel = viewerReq.fuelTypePreference || [];
    const postFuel = Array.isArray(tags.fuelType) ? tags.fuelType.map(String) : [];
    const fuelIntersection = viewerFuel.filter((item) => postFuel.includes(item)).length;
    const fuelOverlap = viewerFuel.length > 0 ? fuelIntersection / viewerFuel.length : 0;

    return Math.min(2, 1 + budgetOverlap * 0.4 + useCaseOverlap * 0.4 + fuelOverlap * 0.2);
  }

  private calcPopularScore(item: {
    forkCount: number;
    likeCount: number;
    commentCount: number;
    viewCount: number;
  }): number {
    return item.forkCount * 3 + item.likeCount * 1 + item.commentCount * 1.5 + item.viewCount * 0.1;
  }

  async listJourneys(params: ListCommunityParams, viewerJourneyId?: string) {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const sort = params.sort ?? 'relevance';

    const viewerJourney = viewerJourneyId
      ? await prisma.journey.findUnique({
          where: { id: viewerJourneyId },
          select: { requirements: true },
        })
      : null;
    const viewerReq = viewerJourney ? toRequirements(viewerJourney.requirements) : null;

    const allLive = await prisma.publishedJourney.findMany({
      where: {
        contentStatus: 'LIVE',
        visibility: 'PUBLIC',
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        journey: { select: { id: true, requirements: true, startedAt: true, completedAt: true, status: true } },
      },
    });

    let filtered = allLive.filter((item) => {
      const tags = toObject(item.tags);
      const carIds = Array.isArray(tags.carIds) ? tags.carIds.map(String) : [];
      const fuelType = Array.isArray(tags.fuelType) ? tags.fuelType.map(String) : [];
      const useCases = Array.isArray(tags.useCases) ? tags.useCases.map(String) : [];
      const budgetMin = typeof tags.budgetMin === 'number' ? tags.budgetMin : undefined;
      const budgetMax = typeof tags.budgetMax === 'number' ? tags.budgetMax : undefined;

      if (params.carIds?.length && !params.carIds.some((carId) => carIds.includes(carId))) {
        return false;
      }
      if (params.fuelType && !fuelType.includes(params.fuelType)) {
        return false;
      }
      if (params.useCases?.length && !params.useCases.some((v) => useCases.includes(v))) {
        return false;
      }
      if (params.hasTemplate && !item.publishedFormats.includes('template')) {
        return false;
      }
      if (params.result === 'purchased' && item.journey.status !== 'COMPLETED') {
        return false;
      }
      if (params.result === 'in_progress' && item.journey.status === 'COMPLETED') {
        return false;
      }

      if (
        params.budgetMin !== undefined &&
        params.budgetMax !== undefined &&
        budgetMin !== undefined &&
        budgetMax !== undefined
      ) {
        const hasOverlap =
          Math.max(params.budgetMin, budgetMin) <= Math.min(params.budgetMax, budgetMax);
        if (!hasOverlap) {
          return false;
        }
      }

      return true;
    });

    const scored = filtered.map((item) => {
      const tags = toObject(item.tags);
      const relevanceBoost = this.calcRelevanceBoost(viewerReq, tags);
      const popularScore = this.calcPopularScore(item);
      const score = popularScore * relevanceBoost;
      return {
        ...item,
        relevanceBoost,
        popularScore,
        score,
      };
    });

    if (sort === 'popular') {
      scored.sort((a, b) => b.popularScore - a.popularScore);
    } else if (sort === 'latest') {
      scored.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    } else {
      if (allLive.length < 500) {
        scored.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
      } else {
        scored.sort((a, b) => b.score - a.score);
      }
    }

    filtered = scored.slice(offset, offset + limit);

    return {
      items: filtered,
      total: scored.length,
      limit,
      offset,
    };
  }

  async getJourneyDetail(id: string) {
    const item = await prisma.publishedJourney.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
        journey: { select: { id: true, status: true, stage: true, requirements: true } },
      },
    });

    if (!item || item.contentStatus !== 'LIVE' || item.visibility !== 'PUBLIC') {
      return null;
    }

    await prisma.publishedJourney.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return item;
  }
}

export const communityService = new CommunityService();
