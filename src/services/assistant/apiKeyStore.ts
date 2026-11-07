/**
 * The user's own AI provider keys and choice of provider/model. Kept in this
 * browser only: local storage when "remember" is on, otherwise for this tab
 * session. A key is sent only to its provider's API.
 */
import type { ProviderId } from './types';

const PREFIX = 'bi-design-studio:';
/** Keys per provider (the Anthropic name predates multi-provider support). */
const KEY_NAMES: Record<ProviderId, string> = {
  anthropic: `${PREFIX}anthropic-api-key`,
  gemini: `${PREFIX}gemini-api-key`,
  openai: `${PREFIX}openai-api-key`,
};
const CHOICE = `${PREFIX}assistant-choice`;

function stores(): Storage[] {
  const list: Storage[] = [];
  try {
    list.push(window.localStorage);
  } catch {
    /* storage blocked */
  }
  try {
    list.push(window.sessionStorage);
  } catch {
    /* storage blocked */
  }
  return list;
}

export const apiKeyStore = {
  get(provider: ProviderId): string | null {
    for (const s of stores()) {
      try {
        const v = s.getItem(KEY_NAMES[provider]);
        if (v) return v;
      } catch {
        /* ignore */
      }
    }
    return null;
  },
  /** Whether the saved key persists across browser sessions. */
  isRemembered(provider: ProviderId): boolean {
    try {
      return Boolean(window.localStorage.getItem(KEY_NAMES[provider]));
    } catch {
      return false;
    }
  },
  set(provider: ProviderId, value: string, remember: boolean): void {
    this.clear(provider);
    const target = remember ? window.localStorage : window.sessionStorage;
    target.setItem(KEY_NAMES[provider], value.trim());
  },
  clear(provider: ProviderId): void {
    for (const s of stores()) {
      try {
        s.removeItem(KEY_NAMES[provider]);
      } catch {
        /* ignore */
      }
    }
  },
};

export interface AssistantChoice {
  provider: ProviderId;
  /** Chosen model per provider. */
  models: Partial<Record<ProviderId, string>>;
}

/** Last chosen provider and models (a convenience; falls back to defaults). */
export const choiceStore = {
  get(): Partial<AssistantChoice> {
    try {
      const raw = window.localStorage.getItem(CHOICE);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? (parsed as Partial<AssistantChoice>) : {};
    } catch {
      return {};
    }
  },
  set(choice: AssistantChoice): void {
    try {
      window.localStorage.setItem(CHOICE, JSON.stringify(choice));
    } catch {
      /* not essential */
    }
  },
};

/** "sk-ant-…a1b2" — enough to recognise the key without showing it. */
export function maskKey(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
