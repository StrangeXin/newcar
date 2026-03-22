import weaviate, { ApiKey, WeaviateClient } from 'weaviate-ts-client';

function parseWeaviateUrl(rawUrl: string): { scheme: 'http' | 'https'; host: string } {
  const url = new URL(rawUrl);
  const scheme = (url.protocol.replace(':', '') as 'http' | 'https') || 'http';
  return {
    scheme,
    host: url.host,
  };
}

const url = process.env.WEAVIATE_URL || 'http://localhost:8080';
const parsed = parseWeaviateUrl(url);

const additionalConfig: {
  apiKey?: ApiKey;
  headers?: Record<string, string>;
} = {};

if (process.env.WEAVIATE_API_KEY) {
  additionalConfig.apiKey = new weaviate.ApiKey(process.env.WEAVIATE_API_KEY);
}
if (process.env.OPENAI_API_KEY || process.env.AI_API_KEY) {
  additionalConfig.headers = {
    'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
  };
}

export const weaviateClient: WeaviateClient = weaviate.client({
  scheme: parsed.scheme,
  host: parsed.host,
  ...additionalConfig,
});
