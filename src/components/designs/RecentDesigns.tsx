import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, FileStack, Layers } from 'lucide-react';
import { themeRepository } from '@/services/themeService';
import { designRepository, type DesignSummary } from '@/services/designRepository';
import { formatRelativeTime } from '@/utils/relativeTime';
import styles from './RecentDesigns.module.css';

type State = { status: 'loading' } | { status: 'ready'; designs: DesignSummary[] } | { status: 'error'; message: string };

interface RecentDesignsProps {
  limit?: number;
  /** Rendered when the user has no saved designs (omit to render nothing). */
  emptyState?: React.ReactNode;
  title?: string;
}

/** List of saved designs, most recently edited first. */
export function RecentDesigns({ limit = 6, emptyState = null, title = 'Recent designs' }: RecentDesignsProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    designRepository.list().then(
      (designs) => !cancelled && setState({ status: 'ready', designs }),
      (err: unknown) => !cancelled && setState({ status: 'error', message: err instanceof Error ? err.message : 'Couldn’t load your designs.' }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return <div className={styles.skeleton} aria-busy="true" aria-label="Loading your designs" />;
  }
  if (state.status === 'error') {
    return (
      <p className={styles.error} role="alert">
        <AlertTriangle size={16} aria-hidden="true" /> {state.message}
      </p>
    );
  }
  if (state.designs.length === 0) return <>{emptyState}</>;

  return (
    <section aria-labelledby="recent-designs-title">
      <h2 id="recent-designs-title" className={styles.title}>
        {title}
      </h2>
      <ul className={styles.list}>
        {state.designs.slice(0, limit).map((d) => (
          <li key={d.id}>
            <Link to={`/editor/${d.id}`} className={styles.card}>
              <span className={styles.icon}>
                <FileStack size={18} aria-hidden="true" />
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{d.name}</span>
                <span className={styles.meta}>
                  Edited {formatRelativeTime(d.updatedAt)} · {themeRepository.get(d.themeId)?.name ?? d.themeId}
                </span>
              </span>
              <span className={styles.pages}>
                <Layers size={13} aria-hidden="true" /> {d.pageCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
