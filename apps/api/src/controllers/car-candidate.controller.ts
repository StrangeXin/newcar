import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { carCandidateService } from '../services/car-candidate.service';
import { CandidateStatus, AddedReason } from '@newcar/shared';
import { buildTimelineEventContent, TIMELINE_EVENT_TYPES, timelineService } from '../services/timeline.service';

async function buildSideEffectPayload(
  journeyId: string,
  type: typeof TIMELINE_EVENT_TYPES.CANDIDATE_ELIMINATED | typeof TIMELINE_EVENT_TYPES.CANDIDATE_WINNER,
  candidate: Record<string, unknown>,
  extraMetadata?: Record<string, unknown>
) {
  const timelineEvent = await timelineService.createEvent({
    journeyId,
    type,
    content: buildTimelineEventContent(type, candidate),
    metadata: {
      ...extraMetadata,
      candidateId: String(candidate.id || ''),
      carId: String(candidate.carId || ''),
    },
  });

  return {
    ...candidate,
    timelineEvent,
  };
}

export class CarCandidateController {
  async addCandidate(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { carId, addedReason, priceAtAdd, userNotes } = req.body;

      if (!carId) {
        return res.status(400).json({ error: 'carId is required' });
      }

      if (!Object.values(AddedReason).includes(addedReason)) {
        return res.status(400).json({ error: 'Invalid addedReason' });
      }

      const owner = await carCandidateService.getJourneyOwner(journeyId);
      if (!owner || owner !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const candidate = await carCandidateService.addCandidate({
        journeyId,
        carId,
        addedReason,
        priceAtAdd,
        userNotes,
      });

      return res.status(201).json(candidate);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async getCandidates(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;

      const owner = await carCandidateService.getJourneyOwner(journeyId);
      if (!owner || owner !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const candidates = await carCandidateService.getCandidatesByJourney(journeyId);
      return res.json({ candidates });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId, candidateId } = req.params;
      const { status, eliminationReason } = req.body;

      if (!Object.values(CandidateStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      if (status === CandidateStatus.WINNER) {
        return res.status(400).json({ error: 'Use POST /candidates/:id/winner to mark a winner' });
      }

      const owner = await carCandidateService.getCandidateJourneyOwner(candidateId);
      if (!owner || owner !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const candidate = await carCandidateService.updateStatus(
        candidateId,
        status,
        eliminationReason
      );
      if (status === CandidateStatus.ELIMINATED) {
        const sideEffectData = await buildSideEffectPayload(
          candidate.journeyId,
          TIMELINE_EVENT_TYPES.CANDIDATE_ELIMINATED,
          candidate as Record<string, unknown>,
          { eliminationReason }
        );
        return res.json({
          ...candidate,
          sideEffects: [
            {
              event: 'candidate_eliminated',
              data: sideEffectData,
            },
          ],
        });
      }

      return res.json(candidate);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async markAsWinner(req: AuthenticatedRequest, res: Response) {
    try {
      const { candidateId } = req.params;

      const owner = await carCandidateService.getCandidateJourneyOwner(candidateId);
      if (!owner || owner !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const candidate = await carCandidateService.markAsWinner(candidateId);
      const sideEffectData = await buildSideEffectPayload(
        candidate.journeyId,
        TIMELINE_EVENT_TYPES.CANDIDATE_WINNER,
        candidate as Record<string, unknown>
      );
      return res.json({
        ...candidate,
        sideEffects: [
          {
            event: 'candidate_winner',
            data: sideEffectData,
          },
        ],
      });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async updateNotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { candidateId } = req.params;
      const { notes } = req.body;

      const owner = await carCandidateService.getCandidateJourneyOwner(candidateId);
      if (!owner || owner !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const candidate = await carCandidateService.updateNotes(candidateId, notes);
      return res.json(candidate);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export const carCandidateController = new CarCandidateController();
