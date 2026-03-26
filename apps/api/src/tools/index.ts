import { tool } from './langchain-shim';
import { z } from 'zod';
import { weaviateService } from '../services/weaviate.service';
import { carService } from '../services/car.service';
import { journeyService } from '../services/journey.service';
import { carCandidateService } from '../services/car-candidate.service';
import { AddedReason, CandidateStatus, JourneyStage } from '@newcar/shared';

// Tool 1: car_search
export const carSearchTool = tool(
  async ({ query, fuel_type, budget_max, car_type }: {
    query: string;
    fuel_type?: 'BEV' | 'PHEV' | 'HEV';
    budget_max?: number;
    car_type?: 'SEDAN' | 'SUV' | 'MPV';
  }) => {
    const results = await weaviateService.searchCars(query, {
      fuelType: fuel_type,
      maxMsrp: budget_max ? budget_max * 10000 : undefined,
      carType: car_type,
    });
    if (results.length === 0) {
      return '未找到匹配的车型，请尝试调整搜索条件。';
    }
    return results
      .slice(0, 5)
      .map((car, i) =>
        `${i + 1}. ${car.brand} ${car.model} ${car.variant} - ${(car.msrp / 10000).toFixed(1)}万 (${car.fuelType}, ${car.carType})`
      )
      .join('\n');
  },
  {
    name: 'car_search',
    description: '搜索车型。根据用户需求搜索匹配的车型，返回前5个结果。',
    schema: z.object({
      query: z.string().describe('搜索query'),
      fuel_type: z.enum(['BEV', 'PHEV', 'HEV']).optional().describe('燃料类型'),
      budget_max: z.number().optional().describe('预算上限（万元）'),
      car_type: z.enum(['SEDAN', 'SUV', 'MPV']).optional().describe('车型类型'),
    }),
  }
);

// Tool 2: car_detail
export const carDetailTool = tool(
  async ({ car_id }: { car_id: string }) => {
    const car = await carService.getCarById(car_id);
    if (!car) return `未找到车型 ID: ${car_id}`;
    return [
      `${car.brand} ${car.model} ${car.variant}`,
      `指导价: ${car.msrp ? `${(car.msrp / 10000).toFixed(1)}万` : '暂无'}`,
      `类型: ${car.type || '未知'}`,
      `燃料类型: ${car.fuelType}`,
    ].join('\n');
  },
  {
    name: 'car_detail',
    description: '获取车型详细信息',
    schema: z.object({
      car_id: z.string().describe('车型ID'),
    }),
  }
);

// Tool 3: journey_read
export const journeyReadTool = tool(
  async ({ journey_id }: { journey_id: string }) => {
    const journey = await journeyService.getJourneyDetail(journey_id);
    if (!journey) return `未找到 Journey: ${journey_id}`;
    const candidates = journey.candidates || [];
    const requirements = (journey.requirements as Record<string, unknown>) || {};
    return [
      `Journey: ${journey.title}`,
      `Stage: ${journey.stage}`,
      `Status: ${journey.status}`,
      `预算范围: ${requirements.budgetMin || '未设置'}万 - ${requirements.budgetMax || '未设置'}万`,
      `候选车型: ${candidates.length}款`,
    ].join('\n');
  },
  {
    name: 'journey_read',
    description: '读取用户Journey状态',
    schema: z.object({
      journey_id: z.string().describe('Journey ID'),
    }),
  }
);

// Tool 4: journey_write
export const journeyWriteTool = tool(
  async ({ journey_id, action, data }: {
    journey_id: string;
    action: 'update_stage' | 'update_requirements' | 'add_candidate' | 'remove_candidate';
    data: Record<string, unknown>;
  }) => {
    switch (action) {
      case 'update_stage':
        if (!data.new_stage) {
          return '缺少 new_stage 参数';
        }
        await journeyService.advanceStage(journey_id, data.new_stage as JourneyStage);
        return `已更新 Journey 阶段到 ${data.new_stage}`;

      case 'update_requirements':
        await journeyService.updateRequirements(journey_id, {
          budgetMin: data.budget_min as number | undefined,
          budgetMax: data.budget_max as number | undefined,
          useCases: data.use_cases as string[] | undefined,
          fuelTypePreference: data.fuel_type_preference as string[] | undefined,
          dailyKm: data.daily_km as number | undefined,
          stylePreference: data.style_preference as string | undefined,
        });
        return '已更新 Journey 需求';

      case 'add_candidate':
        await carCandidateService.addCandidate({
          journeyId: journey_id,
          carId: data.car_id as string,
          addedReason: AddedReason.AI_RECOMMENDED,
        });
        return `已添加车型 ${data.car_id} 到候选列表`;

      case 'remove_candidate': {
        // carCandidateService.removeCandidate takes candidateId, not (journeyId, carId)
        // We need to find the candidate first
        const candidates = await carCandidateService.getCandidatesByJourney(journey_id);
        const candidate = candidates.find(c => c.carId === (data.car_id as string) && c.status === CandidateStatus.ACTIVE);
        if (!candidate) {
          return `未找到车型 ${data.car_id} 在候选列表中`;
        }
        await carCandidateService.removeCandidate(candidate.id);
        return `已从候选列表移除车型 ${data.car_id}`;
      }

      default:
        return `未知 action: ${action}`;
    }
  },
  {
    name: 'journey_write',
    description: '更新Journey状态或候选车型',
    schema: z.object({
      journey_id: z.string(),
      action: z.enum(['update_stage', 'update_requirements', 'add_candidate', 'remove_candidate']),
      data: z.record(z.unknown()),
    }),
  }
);

// Tool 5: notify (TODO - 暂未实现)
export const notifyTool = tool(
  async ({ user_id, template, data }: {
    user_id: string;
    template: string;
    data: Record<string, unknown>;
  }) => {
    return `通知功能暂未实现`;
  },
  {
    name: 'notify',
    description: '发送微信通知',
    schema: z.object({
      user_id: z.string(),
      template: z.string(),
      data: z.record(z.unknown()),
    }),
  }
);
