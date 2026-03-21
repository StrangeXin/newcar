import { randomUUID } from 'crypto';

export function generateSessionId(): string {
  return randomUUID();
}

export function generateId(): string {
  return randomUUID();
}

export function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireConfigValue(value: string | undefined, name: string): string {
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required config: ${name}`);
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
