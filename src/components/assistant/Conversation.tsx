import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/common/Button';
import type { ChatEntry } from '@/state/assistantStore';
import { AttachmentChips } from './AttachmentChips';
import type { AssistantError, DesignProgress } from '@/services/assistant/types';
import styles from './Assistant.module.css';

interface ConversationProps {
  entries: ChatEntry[];
  busy: boolean;
  progress: DesignProgress | null;
  error: AssistantError | null;
  onRetry: () => void;
}

function progressText(p: DesignProgress | null): string {
  if (!p || (p.phase === 'thinking' && !p.note)) return 'Thinking about your dashboard…';
  if (p.phase === 'thinking') return p.note!;
  return `Drawing the design… (${Math.round(p.written / 100) / 10}k characters)`;
}

export function Conversation({ entries, busy, progress, error, onRetry }: ConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [entries.length, busy, error]);

  return (
    <div className={styles.messages} role="log" aria-label="Conversation with the assistant" aria-live="polite">
      {entries.map((e) => (
        <div key={e.id} className={e.role === 'user' ? styles.userMsg : styles.botMsg}>
          {e.role === 'assistant' && <Sparkles size={15} aria-hidden="true" className={styles.botIcon} />}
          <div>
            <span className={styles.srOnly}>{e.role === 'user' ? 'You:' : 'Assistant:'}</span>
            {e.attachments && <AttachmentChips label="Attached files" attachments={e.attachments} />}
            {e.text && <p className={styles.msgText}>{e.text}</p>}
            {e.notes && (
              <ul className={styles.notes} aria-label="Adjustments made to the design">
                {e.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
      {busy && (
        <p className={styles.progress} role="status">
          <Loader2 size={15} className={styles.spin} aria-hidden="true" />
          <span>{progressText(progress)}</span>
        </p>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error.message}</span>
          <Button size="sm" icon={<RotateCcw size={14} aria-hidden="true" />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
