import { prisma } from '../lib/prisma';
import { CandidateStatus, AddedReason } from '@newcar/shared';
import { candidateScoringService } from './candidate-scoring.service';

function mergeStringArray(existing: unknown, incoming?: string[]) {
  const current = Array.isArray(existing) ? existing.map(String) : [];
  const next = incoming && incoming.length > 0 ? incoming : [];
  return Array.from(new Set([...current, ...next]));
}

export class CarCandidateService {
  // 添加候选车型
  async addCandidate(data: {
    journeyId: string;
    carId: string;
    addedReason: AddedReason;
    priceAtAdd?: number;
    userNotes?: string;
    matchTags?: string[];
    recommendReason?: string;
    relevantDimensions?: string[];
  }) {
    // 检查是否已在候选列表中
    const existing = await prisma.carCandidate.findFirst({
      where: {
        journeyId: data.journeyId,
        carId: data.carId,
        status: CandidateStatus.ACTIVE,
      },
      include: { car: true },
    });

    if (existing) {
      const nextData: Record<string, unknown> = {};

      if (data.priceAtAdd !== undefined && existing.priceAtAdd === null) {
        nextData.priceAtAdd = data.priceAtAdd;
      }
      if (data.userNotes && !existing.userNotes) {
        nextData.userNotes = data.userNotes;
      }
      if (data.matchTags && data.matchTags.length > 0) {
        nextData.matchTags = mergeStringArray((existing as any).matchTags, data.matchTags);
      }
      if (data.recommendReason && !(existing as any).recommendReason) {
        nextData.recommendReason = data.recommendReason;
      }
      if (data.relevantDimensions && data.relevantDimensions.length > 0) {
        nextData.relevantDimensions = mergeStringArray((existing as any).relevantDimensions, data.relevantDimensions);
      }

      if (Object.keys(nextData).length > 0) {
        const updated = await (prisma as any).carCandidate.update({
          where: { id: existing.id },
          data: nextData,
          include: { car: true },
        });
        await candidateScoringService.updateRankScore(updated.journeyId, updated.id, { force: true });
        return updated;
      }

      return existing;
    }

    const candidate = await (prisma as any).carCandidate.create({
      data: {
        journeyId: data.journeyId,
        carId: data.carId,
        addedReason: data.addedReason,
        status: CandidateStatus.ACTIVE,
        priceAtAdd: data.priceAtAdd,
        userNotes: data.userNotes,
        matchTags: data.matchTags || [],
        recommendReason: data.recommendReason || null,
        relevantDimensions: data.relevantDimensions || [],
      },
      include: { car: true },
    });

    await candidateScoringService.updateRankScore(candidate.journeyId, candidate.id, { force: true });
    return candidate;
  }

  // 获取旅程的所有候选车型
  async getCandidatesByJourney(journeyId: string) {
    const candidates = await prisma.carCandidate.findMany({
      where: { journeyId },
      include: { car: true },
      orderBy: [
        { addedAt: 'desc' },
      ],
    });

    const statusPriority: Record<string, number> = {
      WINNER: 0,
      ACTIVE: 1,
      ELIMINATED: 2,
    };

    return [...candidates].sort((a, b) => {
      const statusDelta = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (statusDelta !== 0) return statusDelta;

      const scoreA = Number((a as any).candidateRankScore ?? a.aiMatchScore ?? 0);
      const scoreB = Number((b as any).candidateRankScore ?? b.aiMatchScore ?? 0);
      if (scoreA !== scoreB) return scoreB - scoreA;

      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }

  // 更新候选车型状态
  async updateStatus(
    candidateId: string,
    status: CandidateStatus,
    eliminationReason?: string
  ) {
    const candidate = await (prisma as any).carCandidate.update({
      where: { id: candidateId },
      data: {
        status,
        eliminationReason: status === CandidateStatus.ELIMINATED ? eliminationReason : null,
        candidateRankScore: status === CandidateStatus.ELIMINATED ? 0 : undefined,
      },
      include: { car: true },
    });

    await candidateScoringService.updateRankScore(candidate.journeyId, candidate.id, { force: true });
    return candidate;
  }

  // 更新用户兴趣分（由行为事件计算）
  async updateUserInterestScore(candidateId: string, score: number) {
      const candidate = await prisma.carCandidate.update({
        where: { id: candidateId },
        data: { userInterestScore: score },
      });

    await candidateScoringService.updateRankScore(candidate.journeyId, candidate.id);
    return candidate;
  }

  // 更新 AI 匹配分
  async updateAiMatchScore(candidateId: string, score: number) {
    const candidate = await prisma.carCandidate.update({
      where: { id: candidateId },
      data: { aiMatchScore: score },
    });

    await candidateScoringService.updateRankScore(candidate.journeyId, candidate.id);
    return candidate;
  }

  // 更新用户笔记
  async updateNotes(candidateId: string, notes: string) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { userNotes: notes },
    });
  }

  // 标记为胜出者（购车决策）
  async markAsWinner(candidateId: string) {
    const candidate = await prisma.carCandidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const [, winner] = await prisma.$transaction([
      (prisma as any).carCandidate.updateMany({
        where: {
          journeyId: candidate.journeyId,
          id: { not: candidateId },
          status: CandidateStatus.ACTIVE,
        },
        data: {
          status: CandidateStatus.ELIMINATED,
          eliminationReason: '用户选择了其他车型',
          candidateRankScore: 0,
        },
      }),
      (prisma as any).carCandidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.WINNER, candidateRankScore: 1 },
        include: { car: true },
      }),
    ]);

    await candidateScoringService.updateRankScore(candidate.journeyId, candidateId, { force: true });
    return winner;
  }

  // 获取旅程所有者
  async getJourneyOwner(journeyId: string): Promise<string | null> {
    const journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      select: { userId: true },
    });
    return journey?.userId ?? null;
  }

  // 通过候选车型获取旅程所有者
  async getCandidateJourneyOwner(candidateId: string): Promise<string | null> {
    const candidate = await prisma.carCandidate.findUnique({
      where: { id: candidateId },
      include: { journey: { select: { userId: true } } },
    });
    return candidate?.journey.userId ?? null;
  }

  // 移除候选车型
  async removeCandidate(candidateId: string) {
    const candidate = await (prisma as any).carCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.ELIMINATED, candidateRankScore: 0 },
    });

    await candidateScoringService.updateRankScore(candidate.journeyId, candidate.id, { force: true });
    return candidate;
  }
}

export const carCandidateService = new CarCandidateService();
