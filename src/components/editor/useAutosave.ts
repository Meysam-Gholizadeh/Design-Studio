import { useCallback, useEffect } from 'react';
import { toast } from '@/components/common/toastStore';
import { designRepository, type DesignRepository } from '@/services/designRepository';
import { useEditorStore } from '@/state/editorStore';

export const AUTOSAVE_DELAY_MS = 800;

/**
 * Debounced autosave of the editor document. Returns `saveNow` for explicit
 * saves (toolbar button, Ctrl+S). Also warns before closing the tab with
 * unsaved changes and flushes pending changes when the editor unmounts.
 */
export function useAutosave(repository: DesignRepository = designRepository) {
  const version = useEditorStore((s) => s.version);
  const savedVersion = useEditorStore((s) => s.savedVersion);

  const saveNow = useCallback(async () => {
    const s = useEditorStore.getState();
    if (!s.document) return;
    const { id } = s.document;
    const snapshotVersion = s.version;
    s.markSaving(id);
    try {
      await repository.save(s.document);
      useEditorStore.getState().markSaved(id, snapshotVersion);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Couldn’t save your design.';
      useEditorStore.getState().markSaveError(id, message);
      toast.error(message);
    }
  }, [repository]);

  // Debounced save after changes.
  useEffect(() => {
    if (version === savedVersion) return;
    const timer = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [version, savedVersion, saveNow]);

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = useEditorStore.getState();
      if (s.version !== s.savedVersion || s.saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Flush pending changes when leaving the editor inside the app.
  useEffect(
    () => () => {
      const s = useEditorStore.getState();
      if (s.document && s.version !== s.savedVersion) {
        const v = s.version;
        const { id } = s.document;
        repository.save(s.document).then(
          () => useEditorStore.getState().markSaved(id, v),
          (err: unknown) => toast.error(err instanceof Error ? err.message : 'Couldn’t save your latest changes.'),
        );
      }
    },
    [repository],
  );

  return saveNow;
}
