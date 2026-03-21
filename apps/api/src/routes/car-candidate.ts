import { Router } from 'express';
import { carCandidateController } from '../controllers/car-candidate.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 添加候选车型
router.post(
  '/:journeyId/candidates',
  authMiddleware,
  (req, res) => carCandidateController.addCandidate(req, res)
);

// 获取候选车型列表
router.get(
  '/:journeyId/candidates',
  authMiddleware,
  (req, res) => carCandidateController.getCandidates(req, res)
);

// 更新候选车型状态
router.patch(
  '/:journeyId/candidates/:candidateId',
  authMiddleware,
  (req, res) => carCandidateController.updateStatus(req, res)
);

// 标记为胜出者
router.post(
  '/:journeyId/candidates/:candidateId/winner',
  authMiddleware,
  (req, res) => carCandidateController.markAsWinner(req, res)
);

// 更新笔记
router.patch(
  '/:journeyId/candidates/:candidateId/notes',
  authMiddleware,
  (req, res) => carCandidateController.updateNotes(req, res)
);

export default router;
