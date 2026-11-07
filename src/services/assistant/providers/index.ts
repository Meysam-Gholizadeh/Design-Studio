import type { AssistantProvider, ProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { geminiProvider } from './gemini';
import { openaiProvider } from './openai';

export const PROVIDERS: readonly AssistantProvider[] = [anthropicProvider, geminiProvider, openaiProvider];

export function getProvider(id: ProviderId): AssistantProvider {
  return PROVIDERS.find((p) => p.id === id) ?? anthropicProvider;
}

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDERS.some((p) => p.id === value);
}
