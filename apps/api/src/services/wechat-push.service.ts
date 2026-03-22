import axios from 'axios';
import { AttentionSignalType } from '@newcar/shared';
import { config } from '../config';
import { redis } from '../lib/redis';

const ACCESS_TOKEN_KEY = 'wechat:access_token';
const ACCESS_TOKEN_TTL_SECONDS = 7000;

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatSendResponse {
  errcode: number;
  errmsg?: string;
}

interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  metadata?: unknown;
}

type WechatTemplateData = Record<string, { value: string }>;

export class WechatPushService {
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
      const cached = await redis.get(ACCESS_TOKEN_KEY);
      if (cached) {
        return cached;
      }
    } else {
      await redis.del(ACCESS_TOKEN_KEY);
    }

    const url = 'https://api.weixin.qq.com/cgi-bin/token';
    const response = await axios.get<WechatTokenResponse>(url, {
      params: {
        grant_type: 'client_credential',
        appid: config.wechat.appId,
        secret: config.wechat.appSecret,
      },
      timeout: 10_000,
    });

    const token = response.data.access_token;
    if (!token) {
      throw new Error(`Failed to fetch WeChat access_token: ${response.data.errcode || ''} ${response.data.errmsg || ''}`);
    }

    await redis.set(ACCESS_TOKEN_KEY, token, 'EX', ACCESS_TOKEN_TTL_SECONDS);
    return token;
  }

  async sendSubscribeMessage(
    openid: string,
    templateId: string,
    data: WechatTemplateData,
    page?: string
  ): Promise<void> {
    const send = async (forceRefresh = false): Promise<WechatSendResponse> => {
      const accessToken = await this.getAccessToken(forceRefresh);
      const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
      const response = await axios.post<WechatSendResponse>(
        url,
        {
          touser: openid,
          template_id: templateId,
          page,
          data,
        },
        { timeout: 10_000 }
      );
      return response.data;
    };

    let result = await send(false);

    if (result.errcode === 40001) {
      await redis.del(ACCESS_TOKEN_KEY);
      result = await send(true);
    }

    if (result.errcode === 0) {
      return;
    }

    if (result.errcode === 43004) {
      console.warn(`WeChat push skipped: user not subscribed. openid=${openid}`);
      return;
    }

    throw new Error(`WeChat push failed: ${result.errcode} ${result.errmsg || ''}`.trim());
  }

  buildTemplateData(notification: NotificationPayload): WechatTemplateData {
    const metadata = (notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>)
      : {}) as Record<string, unknown>;

    return {
      thing1: { value: this.safeTemplateText(notification.title, 20) },
      thing2: { value: this.safeTemplateText(notification.body || '有新通知', 20) },
      thing3: {
        value: this.safeTemplateText(
          metadata.newValue ? String(metadata.newValue) : metadata.delta ? String(metadata.delta) : '请查看详情',
          20
        ),
      },
      time4: { value: new Date().toISOString().slice(0, 19).replace('T', ' ') },
    };
  }

  async sendNotification(openid: string, notification: NotificationPayload): Promise<void> {
    const templateId = this.resolveTemplateId(notification.type);
    if (!templateId) {
      console.warn(`WeChat push skipped: template ID not configured for type=${notification.type}`);
      return;
    }

    const data = this.buildTemplateData(notification);
    await this.sendSubscribeMessage(openid, templateId, data, '/pages/journey/index');
  }

  private resolveTemplateId(type: string): string {
    switch (type) {
      case AttentionSignalType.PRICE_DROP:
        return config.wechat.templateIds.PRICE_DROP;
      case AttentionSignalType.NEW_REVIEW:
        return config.wechat.templateIds.NEW_REVIEW;
      case AttentionSignalType.POLICY_UPDATE:
        return config.wechat.templateIds.POLICY_UPDATE;
      case AttentionSignalType.OTA_RECALL:
        return config.wechat.templateIds.OTA_RECALL;
      default:
        return '';
    }
  }

  private safeTemplateText(value: string, maxLength: number): string {
    if (!value) {
      return '';
    }
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }
}

export const wechatPushService = new WechatPushService();
