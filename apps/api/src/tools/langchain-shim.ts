// Type shim for langchain tool function
// This avoids importing the massive @langchain/core package during type checking
import { z } from 'zod';

interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
}

type ToolFunc = (
  func: (input: any) => Promise<string>,
  definition: ToolDefinition
) => any;

// This is a placeholder that will be replaced at runtime with the actual langchain tool
export const tool: ToolFunc = ((func: (input: any) => Promise<string>, definition: ToolDefinition) => {
  // At runtime this will be replaced by the actual langchain tool
  return {
    name: definition.name,
    description: definition.description,
    schema: definition.schema,
    lc_namespace: ['tools'],
    invoke: async (input: any) => {
      return await func(input);
    },
  };
}) as any;
