import { useId, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Loader2, Paperclip, Square } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ATTACHMENT_ACCEPT, ATTACHMENT_HELP, checkAttachmentLimits, readAttachment, type Attachment } from '@/services/assistant/attachments';
import { AttachmentChips } from './AttachmentChips';
import { EXAMPLE_BRIEFS } from './exampleBriefs';
import styles from './Assistant.module.css';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  /** First message (a brief) or a follow-up change request. */
  followUp: boolean;
}

export function Composer({ value, onChange, attachments, onAttachmentsChange, onSubmit, onStop, busy, disabled, followUp }: ComposerProps) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const canSend = !busy && !disabled && !reading && (value.trim().length > 0 || attachments.length > 0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (canSend) {
      setFileError(null);
      onSubmit();
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  /** Reads files, keeps the ones that are valid, and explains the rest. */
  const addFiles = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (picked.length === 0 || disabled) return;
    setReading(true);
    setFileError(null);
    const added: Attachment[] = [];
    const problems: string[] = [];
    for (const file of picked) {
      try {
        added.push(await readAttachment(file));
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `"${file.name}" could not be read.`);
      }
    }
    const limit = checkAttachmentLimits(attachments, added);
    if (limit) problems.unshift(limit);
    else if (added.length) onAttachmentsChange([...attachments, ...added]);
    setFileError(problems.length ? problems.join(' ') : null);
    setReading(false);
  };

  const onDrop = (e: DragEvent<HTMLFormElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Pasted screenshots arrive as files; plain text pastes as usual.
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length) {
      e.preventDefault();
      void addFiles(pasted);
    }
  };

  return (
    <form
      className={styles.composer}
      data-dragging={dragging || undefined}
      onSubmit={submit}
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <label htmlFor={id} className={styles.composerLabel}>
        {followUp ? 'Ask for changes' : 'Describe the dashboard you need'}
      </label>
      <AttachmentChips label="Files to send" attachments={attachments} onRemove={(i) => onAttachmentsChange(attachments.filter((_, j) => j !== i))} />
      <textarea
        id={id}
        className={styles.textarea}
        rows={followUp ? 2 : 4}
        maxLength={4000}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={
          followUp
            ? 'e.g. “Add a churn KPI”, “Make page 2 about regions”, “Use the vibrant theme”'
            : 'Who is it for, which questions should it answer, which KPIs matter, how many pages… You can also attach a sketch, screenshot or data file.'
        }
      />
      {fileError && (
        <p className={styles.fileError} role="alert">
          {fileError}
        </p>
      )}
      <div className={styles.composerRow}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon={reading ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : <Paperclip size={15} aria-hidden="true" />}
          disabled={disabled || busy || reading}
          onClick={() => fileRef.current?.click()}
          title={`Attach files: ${ATTACHMENT_HELP}`}
        >
          {reading ? 'Reading…' : 'Attach'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className={styles.fileInput}
          aria-label="Attach files"
          tabIndex={-1}
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            void addFiles(list);
          }}
        />
        <span className={styles.hint}>Enter to send · Shift+Enter for a new line</span>
        {busy ? (
          <Button type="button" icon={<Square size={14} aria-hidden="true" />} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" variant="primary" icon={<ArrowUp size={16} aria-hidden="true" />} disabled={!canSend}>
            {followUp ? 'Send' : 'Design it'}
          </Button>
        )}
      </div>
      {dragging && (
        <div className={styles.dropHint} aria-hidden="true">
          <Paperclip size={18} /> Drop files to attach
        </div>
      )}
      {!followUp && (
        <div className={styles.examples} role="group" aria-label="Example briefs">
          {EXAMPLE_BRIEFS.map((ex) => (
            <button key={ex.label} type="button" className={styles.example} disabled={disabled} onClick={() => onChange(ex.text)}>
              {ex.label}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
