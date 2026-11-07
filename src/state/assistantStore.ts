/**
 * The assistant conversation for this browser tab. Kept in memory so it
 * survives moving between pages; it is not saved. The design is saved when the
 * user opens it in the editor.
 *
 * Two histories are kept: a provider-neutral transcript, and the active
 * provider's own message history (append-only; Claude's includes its thinking
 * blocks). Switching provider mid-conversation rebuilds the native history
 * from the transcript.
 */
import { create } from 'zustand';
import type { DashboardDocument } from '@/domain/schemas/document';
import { ATTACHMENTS_ONLY_MESSAGE, type Attachment } from '@/services/assistant/attachments';
import { getProvider } from '@/services/assistant/providers';
import { planToDocument } from '@/services/assistant/planToDocument';
import { AssistantError, type DesignProgress, type ProviderId, type TranscriptTurn } from '@/services/assistant/types';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Files sent with a user message. */
  attachments?: Attachment[];
  /** Repairs made to the returned design (assistant entries only). */
  notes?: string[];
  /** Whether this answer produced a new version of the design. */
  hasDesign?: boolean;
}

export interface Connection {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

interface AssistantState {
  entries: ChatEntry[];
  transcript: TranscriptTurn[];
  native: { provider: ProviderId; history: unknown[] } | null;
  design: DashboardDocument | null;
  /** Number of design versions produced in this conversation. */
  version: number;
  /** Version that was last saved and opened in the editor. */
  openedVersion: number | null;
  busy: boolean;
  progress: DesignProgress | null;
  error: AssistantError | null;
  markOpened: (version: number) => void;
  send: (connection: Connection, text: string, attachments?: Attachment[]) => Promise<void>;
  retry: (connection: Connection) => Promise<void>;
  /** Cancel the running request. Returns the withdrawn message (and its files) so it can go back into the input. */
  stop: () => { text: string; attachments: Attachment[] } | null;
  reset: () => void;
}

let controller: AbortController | null = null;
let seq = 0;
const entryId = () => `entry-${++seq}`;

const initial = {
  entries: [],
  transcript: [],
  native: null,
  design: null,
  version: 0,
  openedVersion: null,
  busy: false,
  progress: null,
  error: null,
};

const toError = (err: unknown) =>
  err instanceof AssistantError ? err : new AssistantError(err instanceof Error ? err.message : 'Something went wrong while contacting the assistant.');

export const useAssistantStore = create<AssistantState>()((set, get) => {
  /** Run one request for the conversation as it stands (last turn is the user's). */
  async function run(connection: Connection) {
    controller?.abort();
    const own = new AbortController();
    controller = own;
    const provider = getProvider(connection.provider);
    let native = get().native;
    if (!native || native.provider !== provider.id) native = { provider: provider.id, history: provider.fromTranscript(get().transcript) };
    set({ native, busy: true, error: null, progress: { phase: 'thinking', written: 0 } });
    try {
      const turn = await provider.requestDesign({
        apiKey: connection.apiKey,
        model: connection.model,
        history: native.history,
        signal: own.signal,
        onProgress: (progress) => {
          if (controller === own) set({ progress });
        },
      });
      if (controller !== own) return;
      let design = get().design;
      let notes: string[] | undefined;
      const hasDesign = turn.plan.kind === 'design' && turn.plan.pages.some((p) => p.visuals.length > 0);
      if (hasDesign) {
        // Each version gets its own id, so opening a newer version never overwrites one already edited in the editor.
        const converted = planToDocument(turn.plan, { model: turn.model || connection.model });
        design = converted.document;
        notes = converted.notes.length ? converted.notes : undefined;
      }
      set((s) => ({
        transcript: [...s.transcript, { role: 'assistant', text: turn.rawText }],
        native: s.native && { ...s.native, history: [...s.native.history, turn.nativeMessage] },
        entries: [...s.entries, { id: entryId(), role: 'assistant', text: turn.plan.reply || 'Here is the design.', notes, hasDesign }],
        design,
        version: hasDesign ? s.version + 1 : s.version,
        busy: false,
        progress: null,
      }));
    } catch (err) {
      if (controller !== own) return;
      set({ busy: false, progress: null, error: own.signal.aborted ? null : toError(err) });
    } finally {
      if (controller === own) controller = null;
    }
  }

  return {
    ...initial,
    markOpened(version) {
      set({ openedVersion: version });
    },
    async send(connection, text, attachments = []) {
      const typed = text.trim();
      if ((!typed && attachments.length === 0) || get().busy) return;
      // Files alone are a valid message: the model is asked to work from them.
      const message = typed || ATTACHMENTS_ONLY_MESSAGE;
      const files = attachments.length ? { attachments } : {};
      const provider = getProvider(connection.provider);
      set((s) => ({
        entries: [...s.entries, { id: entryId(), role: 'user', text: typed, ...files }],
        transcript: [...s.transcript, { role: 'user', text: message, ...files }],
        native:
          s.native && s.native.provider === provider.id ? { ...s.native, history: [...s.native.history, provider.userMessage(message, attachments)] } : s.native,
      }));
      await run(connection);
    },
    async retry(connection) {
      const last = get().transcript[get().transcript.length - 1];
      if (get().busy || last?.role !== 'user') return;
      await run(connection);
    },
    stop() {
      const last = get().transcript[get().transcript.length - 1];
      controller?.abort();
      controller = null;
      const unanswered = last?.role === 'user';
      // Withdraw the unanswered message so the conversation stays valid.
      set((s) => ({
        busy: false,
        progress: null,
        error: null,
        ...(unanswered
          ? {
              transcript: s.transcript.slice(0, -1),
              entries: s.entries.slice(0, -1),
              native: s.native && { ...s.native, history: s.native.history.slice(0, -1) },
            }
          : {}),
      }));
      if (!unanswered) return null;
      return { text: last.text === ATTACHMENTS_ONLY_MESSAGE && last.attachments?.length ? '' : last.text, attachments: last.attachments ?? [] };
    },
    reset() {
      controller?.abort();
      controller = null;
      set({ ...initial });
    },
  };
});
