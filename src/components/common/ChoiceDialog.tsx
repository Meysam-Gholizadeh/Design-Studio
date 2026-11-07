import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import styles from './ConfirmDialog.module.css';

export interface Choice {
  id: string;
  label: string;
  variant?: ButtonVariant;
}

interface ChoiceDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  choices: Choice[];
  onChoose: (id: string) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

/** Modal with several alternative actions plus Cancel (native <dialog>; Escape cancels; focus starts on Cancel). */
export function ChoiceDialog({ open, title, children, choices, onChoose, onCancel, cancelLabel = 'Cancel' }: ChoiceDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
    >
      {open && (
        <div className={styles.body}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {children && <div className={styles.content}>{children}</div>}
          <div className={styles.actions}>
            <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            {choices.map((c) => (
              <Button key={c.id} variant={c.variant ?? 'secondary'} onClick={() => onChoose(c.id)}>
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}
