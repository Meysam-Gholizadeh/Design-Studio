import { useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2, PanelLeftClose, PanelLeftOpen, RotateCcw, Sparkles } from 'lucide-react';
import { Button, IconButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from '@/components/common/toastStore';
import { ApiKeyPanel } from '@/components/assistant/ApiKeyPanel';
import { Composer } from '@/components/assistant/Composer';
import { Conversation } from '@/components/assistant/Conversation';
import { ResizeHandle } from '@/components/assistant/ResizeHandle';
import { readChatWidth, writeChatWidth } from '@/components/assistant/chatWidth';
import { DashboardPreview } from '@/components/dashboard/DashboardPreview';
import { apiKeyStore, choiceStore } from '@/services/assistant/apiKeyStore';
import type { Attachment } from '@/services/assistant/attachments';
import { PROVIDERS, getProvider, isProviderId } from '@/services/assistant/providers';
import type { ProviderId } from '@/services/assistant/types';
import { designRepository } from '@/services/designRepository';
import { useAssistantStore, type Connection } from '@/state/assistantStore';
import page from './Page.module.css';
import styles from '@/components/assistant/Assistant.module.css';

function initialChoice(): { provider: ProviderId; models: Partial<Record<ProviderId, string>> } {
  const saved = choiceStore.get();
  // Default to a provider the user already has a key for.
  const provider = isProviderId(saved.provider) ? saved.provider : (PROVIDERS.find((p) => apiKeyStore.get(p.id))?.id ?? 'anthropic');
  return { provider, models: saved.models ?? {} };
}

const CHAT_HIDDEN_KEY = 'bi-design-studio:assistant-chat-hidden';

function readChatHidden(): boolean {
  try {
    return window.localStorage.getItem(CHAT_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** AI Design Assistant: describe a dashboard, refine it in conversation, open it in the editor. */
export function AssistantPage() {
  const [choice, setChoice] = useState(initialChoice);
  const info = getProvider(choice.provider);
  const savedModel = choice.models[choice.provider];
  const model = savedModel && info.models.some((m) => m.id === savedModel) ? savedModel : info.defaultModel;
  const [keys, setKeys] = useState<Partial<Record<ProviderId, string | null>>>(() =>
    Object.fromEntries(PROVIDERS.map((p) => [p.id, apiKeyStore.get(p.id)])),
  );
  const apiKey = keys[choice.provider] ?? null;
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [opening, setOpening] = useState(false);
  const [chatHidden, setChatHiddenState] = useState(readChatHidden);
  const chatBodyId = useId();
  const chatPanelId = useId();
  const [chatWidth, setChatWidth] = useState(readChatWidth);
  const setChatHidden = (hidden: boolean) => {
    setChatHiddenState(hidden);
    try {
      window.localStorage.setItem(CHAT_HIDDEN_KEY, hidden ? '1' : '0');
    } catch {
      // Storage unavailable: the choice simply isn't remembered.
    }
  };
  const navigate = useNavigate();
  const { entries, design, version, openedVersion, busy, progress, error } = useAssistantStore();
  const { send, retry, stop, reset, markOpened } = useAssistantStore.getState();

  const updateChoice = (next: typeof choice) => {
    setChoice(next);
    choiceStore.set(next);
  };
  const connection = (): Connection | null => (apiKey ? { provider: choice.provider, model, apiKey } : null);

  const submit = () => {
    const conn = connection();
    if (!conn) return;
    const text = draft;
    const attached = files;
    setDraft('');
    setFiles([]);
    void send(conn, text, attached);
  };

  const onStop = () => {
    const withdrawn = stop();
    if (withdrawn) {
      setDraft(withdrawn.text);
      setFiles(withdrawn.attachments);
    }
  };

  const openInEditor = async () => {
    if (!design) return;
    setOpening(true);
    try {
      // A version that was already opened is not saved again (that would overwrite edits made in the editor).
      if (openedVersion !== version) await designRepository.save(design);
      markOpened(version);
      navigate(`/editor/${design.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The design could not be saved.');
      setOpening(false);
    }
  };

  const startOver = () => {
    setConfirmReset(false);
    setDraft('');
    setFiles([]);
    reset();
  };

  const chat = (
    <aside id={chatPanelId} className={styles.chatPanel} aria-label="AI chat">
      <ResizeHandle width={chatWidth} onResize={setChatWidth} onCommit={writeChatWidth} controls={chatPanelId} />
      <div className={styles.chatHeader}>
        <h2 className={styles.chatTitle}>
          <Sparkles size={17} aria-hidden="true" /> AI chat
        </h2>
        <IconButton label="Hide chat" icon={<PanelLeftClose size={18} />} onClick={() => setChatHidden(true)} aria-expanded={true} aria-controls={chatBodyId} />
      </div>
      <div id={chatBodyId} className={styles.chatBody}>
        <ApiKeyPanel
          key={choice.provider}
          provider={choice.provider}
          model={model}
          apiKey={apiKey}
          onProviderChange={(provider) => updateChoice({ ...choice, provider })}
          onModelChange={(m) => updateChoice({ ...choice, models: { ...choice.models, [choice.provider]: m } })}
          onKeyChange={(key) => setKeys((k) => ({ ...k, [choice.provider]: key }))}
        />
        {entries.length === 0 && (
          <div className={styles.intro}>
            <Sparkles size={20} aria-hidden="true" />
            <p>
              Say who the dashboard is for, the questions it should answer and the KPIs that matter. You can also attach a sketch or screenshot, a data file (Excel, CSV) or a brief (PDF, Word). Missing details are filled with sensible assumptions — you
              can change anything afterwards, here or in the editor.
            </p>
          </div>
        )}
        <Conversation
          entries={entries}
          busy={busy}
          progress={progress}
          error={error}
          onRetry={() => {
            const conn = connection();
            if (conn) void retry(conn);
          }}
        />
      </div>
      <div className={styles.chatFooter}>
        <Composer
          value={draft}
          onChange={setDraft}
          attachments={files}
          onAttachmentsChange={setFiles}
          onSubmit={submit}
          onStop={onStop}
          busy={busy}
          disabled={!apiKey}
          followUp={entries.length > 0}
        />
        {!apiKey && <p className={styles.hint}>Add your {info.label} API key above to start.</p>}
      </div>
    </aside>
  );

  return (
    <div className={styles.layout} data-chat-hidden={chatHidden || undefined} style={{ '--chat-width': `${chatWidth}px` } as CSSProperties}>
      {chatHidden ? (
        <div className={styles.chatRail}>
          <IconButton label="Show chat" icon={<PanelLeftOpen size={18} />} onClick={() => setChatHidden(false)} aria-expanded={false} />
          <span className={styles.railLabel} aria-hidden="true">
            <Sparkles size={16} />
          </span>
          {busy && <Loader2 size={16} className={styles.spin} aria-label="The assistant is working" />}
        </div>
      ) : (
        chat
      )}
      <div className={styles.content}>
      <div className={page.page}>
      <PageHeader
        title="AI Design Assistant"
        description="Describe the dashboard you need and the AI (Claude, Gemini or OpenAI, with your own key) drafts an editable design with fictional sample data. Refine it in conversation, then open it in the editor."
        actions={
          entries.length > 0 ? (
            <>
              <Button icon={<RotateCcw size={16} aria-hidden="true" />} onClick={() => (design && openedVersion !== version ? setConfirmReset(true) : startOver())}>
                Start over
              </Button>
              {design && (
                <Button variant="primary" iconRight={<ArrowRight size={16} aria-hidden="true" />} onClick={() => void openInEditor()} disabled={opening || busy}>
                  Open in editor
                </Button>
              )}
            </>
          ) : undefined
        }
      />

        <section className={styles.previewPane} aria-label="Design preview">
          {design ? (
            <>
              <p className={styles.versionLine}>
                Version {version}
                {openedVersion === version ? ' · opened in the editor' : ' · not saved yet — open it in the editor to keep it'}
              </p>
              <DashboardPreview key={design.id} document={design} />
            </>
          ) : (
            <div className={styles.previewEmpty}>
              <p className={styles.previewEmptyTitle}>Your design appears here</p>
              <p>
                {chatHidden ? 'Show the chat (left) and describe' : 'Describe'} the dashboard you need. Each answer from the assistant updates the preview; nothing
                is saved until you open the design in the editor.
              </p>
            </div>
          )}
        </section>
      </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Start a new conversation?"
        confirmLabel="Start over"
        onConfirm={startOver}
        onCancel={() => setConfirmReset(false)}
      >
        The current design has not been opened in the editor, so it will be lost.
      </ConfirmDialog>
    </div>
  );
}
