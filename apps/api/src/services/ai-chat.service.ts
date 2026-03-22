import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { conversationService } from './conversation.service';
import { journeyService } from '../services/journey.service';
import { MessageRole } from '@newcar/shared';
import { weaviateService } from '../services/weaviate.service';

interface UserPreferences {
  budgetMin?: number;
  budgetMax?: number;
  vehicleType?: string;
  fuelType?: string;
  useCases?: string[];
  brandPreference?: string;
  location?: string;
 智能化?: string;
  space?: string;
}

export class AiChatService {
  private getClient(): Anthropic {
    return new Anthropic({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL,
    });
  }

  async chat(data: {
    journeyId: string;
    userId?: string;
    sessionId: string;
    message: string;
  }): Promise<{ message: string; conversationId: string; extractedSignals: any[] }> {
    // 1. Get or create conversation
    const conversation = await conversationService.getOrCreateConversation({
      journeyId: data.journeyId,
      userId: data.userId,
      sessionId: data.sessionId,
    });

    // 2. Save user message
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.USER,
      content: data.message,
    });

    // 3. Get conversation history (last 20 messages)
    const history = await conversationService.getConversationHistory({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      limit: 20,
    });

    // 4. Get existing journey requirements
    const journey = await journeyService.getJourneyDetail(data.journeyId);
    const existingRequirements = (journey?.requirements as Record<string, any>) || {};

    // 5. Extract and save preferences from current message
    const extractedPrefs = this.extractPreferences(data.message);
    const signals = this.buildSignals(extractedPrefs, existingRequirements);

    // 6. Save extracted preferences to journey
    if (Object.keys(extractedPrefs).length > 0) {
      await this.savePreferences(data.journeyId, extractedPrefs, existingRequirements);
    }

    // 7. Run tools for context
    const toolContext = await this.runToolsForMessage(data.message, extractedPrefs);

    // 8. Build user profile summary for AI context
    const userProfile = this.buildUserProfile(existingRequirements, extractedPrefs);

    // 9. Build system prompt with user context
    const systemPrompt = this.buildSystemPrompt(userProfile, toolContext);

    // 10. Call AI API
    const client = this.getClient();
    let aiContent: string;
    try {
      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: systemPrompt,
        messages: history.map((m: any) => ({
          role: m.role === 'USER' ? 'user' : 'assistant',
          content: m.content,
        })),
      });
      const textBlock = response.content.find((block: any) => block.type === 'text');
      aiContent = textBlock?.text ?? '';
    } catch (err: any) {
      console.error('AI API error:', err?.message || err);
      aiContent = '抱歉，我现在无法回答。请稍后再试。';
    }

    // 11. Save AI response
    await conversationService.addMessage({
      journeyId: data.journeyId,
      sessionId: data.sessionId,
      userId: data.userId,
      role: MessageRole.ASSISTANT,
      content: aiContent,
    });

    // 12. Update journey activity
    await journeyService.updateAiConfidenceScore(data.journeyId, 0.7);

    return {
      message: aiContent,
      conversationId: conversation.id,
      extractedSignals: signals,
    };
  }

  private extractPreferences(message: string): Partial<UserPreferences> {
    const prefs: Partial<UserPreferences> = {};

    // 预算
    const budgetMatch = message.match(/(\d+)\s*万左右?/);
    if (budgetMatch) {
      prefs.budgetMax = parseInt(budgetMatch[1]);
    }
    const budgetRangeMatch = message.match(/(\d+)-(\d+)\s*万/);
    if (budgetRangeMatch) {
      prefs.budgetMin = parseInt(budgetRangeMatch[1]);
      prefs.budgetMax = parseInt(budgetRangeMatch[2]);
    }

    // 车型
    if (message.includes('SUV') || message.includes('越野') || message.includes('运动型')) {
      prefs.vehicleType = 'SUV';
    } else if (message.includes('轿车') || message.includes('三厢')) {
      prefs.vehicleType = 'SEDAN';
    } else if (message.includes('MPV') || message.includes('七座') || message.includes('商务')) {
      prefs.vehicleType = 'MPV';
    }

    // 能源类型
    if (message.includes('纯电') || message.includes('电车') || message.includes('BEV')) {
      prefs.fuelType = 'BEV';
    } else if (message.includes('混动') || message.includes('PHEV') || message.includes('双擎')) {
      prefs.fuelType = 'PHEV';
    } else if (message.includes('燃油') || message.includes('油车') || message.includes('汽油')) {
      prefs.fuelType = 'ICE';
    }

    // 用车场景
    if (message.includes('通勤') || message.includes('上下班') || message.includes('日常')) {
      prefs.useCases = prefs.useCases || [];
      if (!prefs.useCases.includes('commute')) prefs.useCases.push('commute');
    }
    if (message.includes('家庭') || message.includes('家用')) {
      prefs.useCases = prefs.useCases || [];
      if (!prefs.useCases.includes('family')) prefs.useCases.push('family');
    }
    if (message.includes('长途') || message.includes('自驾游') || message.includes('旅行')) {
      prefs.useCases = prefs.useCases || [];
      if (!prefs.useCases.includes('road_trip')) prefs.useCases.push('road_trip');
    }

    // 地区
    if (message.includes('南方')) {
      prefs.location = 'south';
    } else if (message.includes('北方')) {
      prefs.location = 'north';
    }

    // 人数
    const peopleMatch = message.match(/(\d+)\s*个人?/);
    if (peopleMatch) {
      const count = parseInt(peopleMatch[1]);
      if (count <= 2) {
        prefs.space = 'compact';
      } else if (count <= 4) {
        prefs.space = 'medium';
      } else {
        prefs.space = 'large';
      }
    }

    // 智能化
    if (message.includes('智能') || message.includes('智驾') || message.includes('辅助驾驶')) {
      prefs.智能化 = 'high';
    }

    // 品牌偏好
    if (message.includes('国产') || message.includes('自主品牌')) {
      prefs.brandPreference = 'domestic';
    } else if (message.includes('合资') || message.includes('外资')) {
      prefs.brandPreference = 'imported';
    }

    return prefs;
  }

  private buildSignals(newPrefs: Partial<UserPreferences>, existing: Record<string, any>): any[] {
    const signals = [];

    if (newPrefs.budgetMax || newPrefs.budgetMin) {
      signals.push({
        type: 'BUDGET',
        value: newPrefs.budgetMin ? `${newPrefs.budgetMin}-${newPrefs.budgetMax}` : String(newPrefs.budgetMax),
        confidence: 0.8,
        updatedAt: new Date().toISOString(),
      });
    }
    if (newPrefs.fuelType) {
      signals.push({
        type: 'PREFERENCE',
        value: newPrefs.fuelType,
        confidence: 0.7,
        updatedAt: new Date().toISOString(),
      });
    }
    if (newPrefs.vehicleType) {
      signals.push({
        type: 'PREFERENCE',
        value: `vehicle_${newPrefs.vehicleType}`,
        confidence: 0.7,
        updatedAt: new Date().toISOString(),
      });
    }

    return signals;
  }

  private async savePreferences(
    journeyId: string,
    newPrefs: Partial<UserPreferences>,
    existing: Record<string, any>
  ): Promise<void> {
    const merged: Record<string, any> = { ...existing };

    if (newPrefs.budgetMin) merged.budgetMin = newPrefs.budgetMin;
    if (newPrefs.budgetMax) merged.budgetMax = newPrefs.budgetMax;
    if (newPrefs.vehicleType) merged.vehicleType = newPrefs.vehicleType;
    if (newPrefs.fuelType) merged.fuelTypePreference = [newPrefs.fuelType];
    if (newPrefs.useCases) merged.useCases = newPrefs.useCases;
    if (newPrefs.location) merged.location = newPrefs.location;
    if (newPrefs.space) merged.spaceRequirement = newPrefs.space;
    if (newPrefs.智能化) merged.智能化 = newPrefs.智能化;
    if (newPrefs.brandPreference) merged.brandPreference = newPrefs.brandPreference;

    try {
      await journeyService.updateRequirements(journeyId, {
        budgetMin: merged.budgetMin,
        budgetMax: merged.budgetMax,
        fuelTypePreference: merged.fuelTypePreference,
        useCases: merged.useCases,
        stylePreference: merged.vehicleType,
      });
      console.log('Preferences saved:', merged);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  }

  private buildUserProfile(existing: Record<string, any>, newPrefs: Partial<UserPreferences>): string {
    const profile: string[] = [];

    // Budget
    if (existing.budgetMin || existing.budgetMax || newPrefs.budgetMax) {
      const min = existing.budgetMin || newPrefs.budgetMin;
      const max = existing.budgetMax || newPrefs.budgetMax;
      if (min && max) {
        profile.push(`预算: ${min}-${max}万`);
      } else if (max) {
        profile.push(`预算: ${max}万左右`);
      }
    }

    // Vehicle type
    const vehicleType = existing.vehicleType || newPrefs.vehicleType;
    if (vehicleType) {
      profile.push(`车型偏好: ${vehicleType}`);
    }

    // Fuel type
    const fuelType = existing.fuelTypePreference?.[0] || newPrefs.fuelType;
    if (fuelType) {
      const fuelMap: Record<string, string> = { BEV: '纯电', PHEV: '混动', ICE: '燃油' };
      profile.push(`能源类型: ${fuelMap[fuelType] || fuelType}`);
    }

    // Use cases
    const useCases = existing.useCases || newPrefs.useCases;
    if (useCases?.length) {
      const useCaseMap: Record<string, string> = {
        commute: '日常通勤',
        family: '家庭出行',
        road_trip: '长途自驾',
      };
      profile.push(`用车场景: ${useCases.map(u => useCaseMap[u] || u).join(', ')}`);
    }

    // Location
    const location = existing.location || newPrefs.location;
    if (location) {
      profile.push(`所在地区: ${location === 'south' ? '南方' : '北方'}`);
    }

    // Smart/智能化
    const smartLevel = existing.智能化 || newPrefs.智能化;
    if (smartLevel) {
      profile.push(`智能化要求: ${smartLevel === 'high' ? '高' : '一般'}`);
    }

    // Brand preference
    const brand = existing.brandPreference || newPrefs.brandPreference;
    if (brand) {
      profile.push(`品牌偏好: ${brand === 'domestic' ? '国产' : brand === 'imported' ? '合资/进口' : brand}`);
    }

    return profile.length > 0
      ? `【用户已知信息】\n${profile.join('\n')}\n\n请基于以上已知信息回答，不要重复询问用户已提供的信息。`
      : '';
  }

  private async runToolsForMessage(
    message: string,
    prefs: Partial<UserPreferences>
  ): Promise<string> {
    try {
      if (message.includes('想买') || message.includes('搜索') || message.includes('找') ||
          message.includes('推荐') || message.includes('对比')) {
        const results = await weaviateService.searchCars('', {
          fuelType: prefs.fuelType as any,
          maxMsrp: prefs.budgetMax ? prefs.budgetMax * 10000 : undefined,
          carType: prefs.vehicleType as any,
        });

        if (results.length > 0) {
          return `\n\n【车型搜索结果】\n${results.slice(0, 5).map((car, i) =>
            `${i + 1}. ${car.brand} ${car.model} ${car.variant} - ${(car.msrp / 10000).toFixed(1)}万`
          ).join('\n')}`;
        }
      }
    } catch (err) {
      console.error('Tool error:', err);
    }
    return '';
  }

  private buildSystemPrompt(userProfile: string, toolContext: string): string {
    return `你是用户的购车助手，帮助用户完成购车决策。

你的职责：
1. 了解用户需求（预算、用车场景、家庭情况等）
2. 搜索和推荐合适的候选车型
3. 帮助用户对比和分析候选车型
4. 跟踪用户的偏好变化

【重要规则】
- 用户已提供的信息不要重复询问
- 如果用户已经说了预算、车型、用途等，直接使用，不要再问
- 先根据已知信息推荐车型，如果信息不够再追问缺失的关键项
- 每次回复尽量给出具体的车型推荐，而不是继续提问

请用友好、专业的语气与用户交流。${userProfile}${toolContext}`;
  }
}

export const aiChatService = new AiChatService();
