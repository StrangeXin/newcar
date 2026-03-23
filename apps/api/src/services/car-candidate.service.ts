import { prisma } from '../lib/prisma';
import { CandidateStatus, AddedReason } from '@newcar/shared';

export class CarCandidateService {
  // 添加候选车型
  async addCandidate(data: {
    journeyId: string;
    carId: string;
    addedReason: AddedReason;
    priceAtAdd?: number;
    userNotes?: string;
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
      return existing;
    }

    return prisma.carCandidate.create({
      data: {
        journeyId: data.journeyId,
        carId: data.carId,
        addedReason: data.addedReason,
        status: CandidateStatus.ACTIVE,
        priceAtAdd: data.priceAtAdd,
        userNotes: data.userNotes,
      },
      include: { car: true },
    });
  }

  // 获取旅程的所有候选车型
  async getCandidatesByJourney(journeyId: string) {
    return prisma.carCandidate.findMany({
      where: { journeyId },
      include: { car: true },
      orderBy: [
        { status: 'asc' },
        { addedAt: 'desc' },
      ],
    });
  }

  // 更新候选车型状态
  async updateStatus(
    candidateId: string,
    status: CandidateStatus,
    eliminationReason?: string
  ) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: {
        status,
        eliminationReason: status === CandidateStatus.ELIMINATED ? eliminationReason : null,
      },
      include: { car: true },
    });
  }

  // 更新用户兴趣分（由行为事件计算）
  async updateUserInterestScore(candidateId: string, score: number) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { userInterestScore: score },
    });
  }

  // 更新 AI 匹配分
  async updateAiMatchScore(candidateId: string, score: number) {
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { aiMatchScore: score },
    });
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
      prisma.carCandidate.updateMany({
        where: {
          journeyId: candidate.journeyId,
          id: { not: candidateId },
          status: CandidateStatus.ACTIVE,
        },
        data: {
          status: CandidateStatus.ELIMINATED,
          eliminationReason: '用户选择了其他车型',
        },
      }),
      prisma.carCandidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.WINNER },
        include: { car: true },
      }),
    ]);

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
    return prisma.carCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.ELIMINATED },
    });
  }
}

export const carCandidateService = new CarCandidateService();
