import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { limit } = req.query;

      const notifications = await notificationService.getUserNotifications(
        userId,
        limit ? parseInt(String(limit), 10) : 20
      );

      return res.json(notifications);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { notificationId } = req.params;

      await notificationService.markAsRead(notificationId, userId);
      return res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
}

export const notificationController = new NotificationController();
