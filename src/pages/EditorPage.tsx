import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, FileQuestion, Loader2 } from 'lucide-react';
import { ButtonLink } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { EditorShell } from '@/components/editor/EditorShell';
import { designRepository } from '@/services/designRepository';
import { useEditorStore } from '@/state/editorStore';
import styles from './EditorPage.module.css';

type LoadState = { id: string } & ({ status: 'loading' } | { status: 'not-found' } | { status: 'error'; message: string });

/** Loads a saved design into the editor store (unless it is already open) and shows the editor. */
export function EditorPage() {
  const { designId = '' } = useParams();
  const openId = useEditorStore((s) => s.document?.id);
  const [loadState, setLoad] = useState<LoadState>({ id: designId, status: 'loading' });
  // A result for a different design ID is stale.
  const load: LoadState = loadState.id === designId ? loadState : { id: designId, status: 'loading' };
  const ready = openId === designId;

  useEffect(() => {
    if (useEditorStore.getState().document?.id === designId) return;
    let cancelled = false;
    designRepository.get(designId).then(
      (doc) => {
        if (cancelled) return;
        if (doc) useEditorStore.getState().load(doc, { persisted: true });
        else setLoad({ id: designId, status: 'not-found' });
      },
      (err: unknown) => {
        if (!cancelled) setLoad({ id: designId, status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [designId]);

  if (ready) return <EditorShell />;

  if (load.status === 'not-found' || load.status === 'error') {
    return (
      <div className={styles.center}>
        <EmptyState
          icon={load.status === 'error' ? <AlertTriangle size={22} aria-hidden="true" /> : <FileQuestion size={22} aria-hidden="true" />}
          title={load.status === 'error' ? 'This design couldn’t be opened' : 'Design not found'}
          description={
            load.status === 'error'
              ? load.message
              : 'It may have been deleted, or it was a blank design that was never changed (blank designs are saved after your first edit).'
          }
          action={
            <div className={styles.actions}>
              <ButtonLink to="/editor/new" variant="primary">
                Create from blank
              </ButtonLink>
              <ButtonLink to="/editor" variant="secondary">
                Open another design
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.center} role="status">
      <Loader2 className={styles.spinner} size={28} aria-hidden="true" />
      <span>Opening design…</span>
    </div>
  );
}
