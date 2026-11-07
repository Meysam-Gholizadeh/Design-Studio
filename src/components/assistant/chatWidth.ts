/** Width of the docked AI chat panel (remembered per browser). */
export const CHAT_MIN_WIDTH = 300;
export const CHAT_DEFAULT_WIDTH = 380;
const KEY = 'bi-design-studio:assistant-chat-width';

/** Largest chat width: keeps room for the navigation and at least ~420 px of preview. */
export function chatMaxWidth(): number {
  return Math.max(CHAT_MIN_WIDTH, Math.min(760, window.innerWidth - 420 - 240));
}

export function clampChatWidth(width: number): number {
  return Math.round(Math.min(chatMaxWidth(), Math.max(CHAT_MIN_WIDTH, width)));
}

export function readChatWidth(): number {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return clampChatWidth(Number.isFinite(n) && n > 0 ? n : CHAT_DEFAULT_WIDTH);
  } catch {
    return clampChatWidth(CHAT_DEFAULT_WIDTH);
  }
}

export function writeChatWidth(width: number): void {
  try {
    window.localStorage.setItem(KEY, String(width));
  } catch {
    // Storage unavailable: the width simply isn't remembered.
  }
}
