// Type shim for langchain tool function
// This avoids importing the massive @langchain/core package during type checking
import { z } from 'zod';

interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shim boundary: must accept diverse tool function signatures
type ToolInputFn = (input: any) => Promise<string>;

type ToolFunc = (
  func: ToolInputFn,
  definition: ToolDefinition
) => unknown;

// This is a placeholder that will be replaced at runtime with the actual langchain tool
export const tool: ToolFunc = ((func: ToolInputFn, definition: ToolDefinition) => {
  // At runtime this will be replaced by the actual langchain tool
  return {
    name: definition.name,
    description: definition.description,
    schema: definition.schema,
    lc_namespace: ['tools'],
    invoke: async (input: unknown) => {
      return await func(input);
    },
  };
}) as unknown as ToolFunc;
