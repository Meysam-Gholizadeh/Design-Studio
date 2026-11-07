/**
 * Provider-neutral contracts for the AI assistant. Each AI provider (Anthropic
 * Claude, Google Gemini) implements `AssistantProvider`; the design-plan
 * schema, the prompt, the repair step and the UI are shared.
 */
import type { Attachment } from './attachments';
import { designPlanSchema, type DesignPlan } from './designPlan';

export type ProviderId = 'anthropic' | 'gemini' | 'openai';

/** A failure with a message written for the user. */
export class AssistantError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

export interface DesignProgress {
  phase: 'thinking' | 'writing';
  /** Latest line of the model's summarised reasoning, when available. */
  note?: string;
  /** Characters of the design written so far. */
  written: number;
}

/** Provider-neutral record of the conversation (assistant text is the raw JSON plan). */
export interface TranscriptTurn {
  role: 'user' | 'assistant';
  text: string;
  /** Files attached to a user message. */
  attachments?: Attachment[];
}

export interface DesignTurn {
  plan: DesignPlan;
  /** The assistant turn in the provider's own message format, to append to its history. */
  nativeMessage: unknown;
  /** The JSON text of the answer (for the neutral transcript). */
  rawText: string;
  /** Model that answered (may differ from the requested one when a fallback ran). */
  model: string;
}

export interface ProviderModel {
  id: string;
  label: string;
  note: string;
}

export interface DesignRequest {
  apiKey: string;
  model: string;
  /** History in the provider's own format; the last entry is the user's new message. */
  history: unknown[];
  signal?: AbortSignal;
  onProgress?: (progress: DesignProgress) => void;
}

export interface AssistantProvider {
  id: ProviderId;
  /** "Anthropic Claude", "Google Gemini". */
  label: string;
  /** Where to create a key. */
  keyUrl: string;
  keyUrlLabel: string;
  keyPlaceholder: string;
  /** Short format hint shown when the key is rejected locally. */
  keyHint: string;
  looksLikeKey: (value: string) => boolean;
  models: ProviderModel[];
  defaultModel: string;
  /** A user message (with any attached files) in the provider's format. */
  userMessage: (text: string, attachments?: Attachment[]) => unknown;
  /** Rebuild provider history from the neutral transcript (when the provider changes mid-conversation). */
  fromTranscript: (turns: TranscriptTurn[]) => unknown[];
  requestDesign: (request: DesignRequest) => Promise<DesignTurn>;
}

/** Parse and validate the JSON text of an answer. */
export function parsePlanText(text: string): DesignPlan {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AssistantError('The assistant returned an unreadable answer. Try again.', true);
  }
  const parsed = designPlanSchema.safeParse(json);
  if (!parsed.success) throw new AssistantError('The assistant returned a design in an unexpected format. Try again.', true);
  return parsed.data;
}

/** Last non-empty line of a reasoning summary, for the progress line. */
export function lastLine(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[#*\s-]+|\*+$/g, '').trim())
    .filter(Boolean);
  const line = lines[lines.length - 1];
  return line ? line.slice(0, 160) : undefined;
}
