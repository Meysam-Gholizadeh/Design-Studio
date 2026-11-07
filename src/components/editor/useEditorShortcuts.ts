import { useEffect } from 'react';
import { toast } from '@/components/common/toastStore';
import { useEditorStore } from '@/state/editorStore';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Editor keyboard shortcuts:
 * Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z or Ctrl+Y redo · Ctrl/Cmd+S save ·
 * Ctrl/Cmd+D duplicate · Delete/Backspace delete · Escape deselect ·
 * Arrows move · Shift+Arrows resize.
 */
export function useEditorShortcuts(saveNow: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const s = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const typing = isTypingTarget(e.target);

      if (mod && key === 's') {
        e.preventDefault();
        saveNow();
        return;
      }
      if (s.mode === 'preview') {
        if (key === 'escape') s.setMode('edit');
        return;
      }
      if (typing) return; // Let inputs handle their own keys (including text undo).

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        const r = s.duplicateSelected();
        if (!r.ok) toast.error(r.reason);
        return;
      }
      if (!s.selectedId) return;
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        s.deleteSelected();
      } else if (key === 'escape') {
        s.select(null);
        (document.activeElement as HTMLElement | null)?.blur();
      } else if (key.startsWith('arrow')) {
        e.preventDefault();
        const d = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key] as [number, number] | undefined;
        if (!d) return;
        const r = e.shiftKey ? s.nudgeSelected(0, 0, d[0], d[1]) : s.nudgeSelected(d[0], d[1]);
        if (!r.ok) toast.info(r.reason);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);
}
