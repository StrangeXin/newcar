import { addCandidateTool, runAddCandidate } from './add-candidate.tool';
import { carDetailTool, runCarDetail } from './car-detail.tool';
import { carSearchTool, runCarSearch } from './car-search.tool';
import { journeyUpdateTool, runJourneyUpdate } from './journey-update.tool';

export type ChatToolName = 'car_search' | 'car_detail' | 'journey_update' | 'add_candidate';

export interface ChatSideEffect {
  event: 'candidate_added' | 'journey_updated' | 'stage_changed';
  data: unknown;
}

export const chatTools = [carSearchTool, carDetailTool, journeyUpdateTool, addCandidateTool];

export async function executeChatTool(
  name: ChatToolName,
  input: Record<string, unknown>,
  context: { journeyId: string; userId?: string }
): Promise<{ output: unknown; sideEffects: ChatSideEffect[] }> {
  switch (name) {
    case 'car_search':
      return { output: await runCarSearch(input), sideEffects: [] };
    case 'car_detail':
      return { output: await runCarDetail(input), sideEffects: [] };
    case 'journey_update':
      return runJourneyUpdate(context.journeyId, input);
    case 'add_candidate':
      return runAddCandidate(context.journeyId, input);
    default:
      throw new Error(`Unsupported tool: ${name}`);
  }
}
