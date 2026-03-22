import { AddedReason, JourneyStatus } from '@newcar/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

function toObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export class ForkService {
  async forkJourney(sourcePublishedJourneyId: string, userId: string) {
    const source = await prisma.publishedJourney.findUnique({
      where: { id: sourcePublishedJourneyId },
      include: { journey: true },
    });

    if (!source || source.contentStatus !== 'LIVE') {
      throw new Error('Source published journey not found');
    }

    if (!source.publishedFormats.includes('template')) {
      throw new Error('This journey does not provide reusable template');
    }

    const active = await prisma.journey.findFirst({
      where: { userId, status: JourneyStatus.ACTIVE },
      select: { id: true },
    });
    if (active) {
      throw new Error('User already has an active journey');
    }

    const templateData = toObject(source.templateData);
    const tags = toObject(source.tags);
    const candidateCarIds = Array.isArray(templateData.candidateCarIds)
      ? templateData.candidateCarIds.map(String)
      : Array.isArray(tags.carIds)
        ? tags.carIds.map(String)
        : [];

    const requirements =
      (toObject(templateData.requirements) as Record<string, unknown>) ||
      ({
        budgetMin: tags.budgetMin,
        budgetMax: tags.budgetMax,
        useCases: tags.useCases,
        fuelTypePreference: tags.fuelType,
      } as Record<string, unknown>);

    const newJourney = await prisma.journey.create({
      data: {
        userId,
        title: `从「${source.title}」出发`,
        templateSourceId: source.journeyId,
        requirements: requirements as Prisma.InputJsonValue,
        status: JourneyStatus.ACTIVE,
      },
    });

    if (candidateCarIds.length > 0) {
      await prisma.carCandidate.createMany({
        data: candidateCarIds.map((carId) => ({
          journeyId: newJourney.id,
          carId,
          status: 'ACTIVE',
          addedReason: AddedReason.FROM_TEMPLATE,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.journeyFork.create({
      data: {
        sourcePublishedJourneyId,
        newJourneyId: newJourney.id,
        userId,
        inheritedCandidates: candidateCarIds,
        inheritedFramework: templateData as Prisma.InputJsonValue,
      },
    });

    await prisma.publishedJourney.update({
      where: { id: sourcePublishedJourneyId },
      data: { forkCount: { increment: 1 } },
    });

    return { journeyId: newJourney.id };
  }
}

export const forkService = new ForkService();
