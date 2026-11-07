import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** Information only: a single button (the confirm label) that closes the dialog. */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation built on the native <dialog> element (focus trapping,
 * Escape to cancel, inert background). Focus starts on Cancel for destructive actions.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', hideCancel = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      (hideCancel ? confirmRef : cancelRef).current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open, hideCancel]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
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
          <h2 id="confirm-title" className={styles.title}>
            {title}
          </h2>
          {children && <div className={styles.content}>{children}</div>}
          <div className={styles.actions}>
            {!hideCancel && (
              <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
                {cancelLabel}
              </Button>
            )}
            <Button ref={confirmRef} variant={tone} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
