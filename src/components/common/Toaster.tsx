import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore } from './toastStore';
import styles from './Toaster.module.css';

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle };

/** Global, screen-reader-announced notifications. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className={styles.region} role="region" aria-label="Notifications">
      <div aria-live="polite" className={styles.stack}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className={styles.toast} data-tone={t.tone} role={t.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={18} aria-hidden="true" className={styles.icon} />
              <span className={styles.message}>{t.message}</span>
              <button type="button" className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
