import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { prisma } from '../lib/prisma';

export class ModerationService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async preReview(content: string): Promise<{ passed: boolean; reason?: string }> {
    try {
      const client = this.getClient();
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: `你是一个内容审核员。请检测用户提交的购车经历内容是否包含以下违规内容：
1. 违禁政治内容
2. 明显虚假信息（如伪造购车结论、编造不实数据）
3. 商业广告/推广（如隐性广告、利益相关推广）

请返回纯 JSON 格式，不要有任何额外文字：
{ "passed": true/false, "reason": "原因（仅在 passed=false 时填写）" }`,
        messages: [
          {
            role: 'user',
            content: `请审核以下内容：\n\n${content}`,
          },
        ],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { passed: true };
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        passed: Boolean(result.passed),
        reason: result.reason,
      };
    } catch (err) {
      console.error('ModerationService.preReview error:', err);
      // AI 故障时默认通过，不阻断发布
      return { passed: true };
    }
  }

  async getReviewQueue(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.publishedJourney.findMany({
        where: { contentStatus: 'PENDING_REVIEW' },
        skip,
        take: limit,
        orderBy: { publishedAt: 'asc' },
        include: { user: true, journey: true },
      }),
      prisma.publishedJourney.count({
        where: { contentStatus: 'PENDING_REVIEW' },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveContent(publishedJourneyId: string) {
    return prisma.publishedJourney.update({
      where: { id: publishedJourneyId },
      data: { contentStatus: 'LIVE' },
    });
  }

  async rejectContent(publishedJourneyId: string, reason: string) {
    return prisma.publishedJourney.update({
      where: { id: publishedJourneyId },
      data: {
        contentStatus: 'REJECTED',
        tags: {
          rejectionReason: reason,
        },
      },
    });
  }
}

export const moderationService = new ModerationService();
