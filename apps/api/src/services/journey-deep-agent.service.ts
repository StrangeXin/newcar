// Barrel re-export — the implementation has been split into focused modules under ./agent/
export { JourneyDeepAgentService, journeyDeepAgentService } from './agent/agent.service';
export type { JourneyAgentStreamEvent } from './agent/agent-stream';
export type { JourneyWorkspaceContext } from './agent/agent-context';
