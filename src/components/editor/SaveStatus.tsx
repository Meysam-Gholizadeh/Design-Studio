import { AlertCircle, Check, CircleDashed, Loader2 } from 'lucide-react';
import { useEditorStore } from '@/state/editorStore';
import styles from './SaveStatus.module.css';

/** Text + icon save indicator (never color alone). */
export function SaveStatus() {
  const status = useEditorStore((s) => s.saveStatus);
  const dirty = useEditorStore((s) => s.version !== s.savedVersion);
  const persisted = useEditorStore((s) => s.persisted);
  const error = useEditorStore((s) => s.saveError);

  let tone = 'neutral';
  let icon = <CircleDashed size={14} aria-hidden="true" />;
  let text = 'Not saved yet';
  if (status === 'saving') {
    icon = <Loader2 size={14} className={styles.spin} aria-hidden="true" />;
    text = 'Saving…';
  } else if (status === 'error') {
    tone = 'error';
    icon = <AlertCircle size={14} aria-hidden="true" />;
    text = 'Not saved';
  } else if (dirty) {
    icon = <CircleDashed size={14} aria-hidden="true" />;
    text = 'Unsaved changes';
  } else if (persisted) {
    tone = 'ok';
    icon = <Check size={14} aria-hidden="true" />;
    text = 'Your changes are saved';
  }

  return (
    <span className={styles.status} data-tone={tone} role="status" aria-live="polite" title={status === 'error' ? (error ?? undefined) : undefined} data-testid="save-status">
      {icon}
      {text}
    </span>
  );
}
