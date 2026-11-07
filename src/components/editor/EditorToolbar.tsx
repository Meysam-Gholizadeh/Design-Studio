import { useState } from 'react';
import { Link } from 'react-router';
import { Eye, PanelLeft, PanelRight, Pencil, Plus, Redo2, Save, Undo2 } from 'lucide-react';
import { Button, IconButton } from '@/components/common/Button';
import { toast } from '@/components/common/toastStore';
import { useEditorStore } from '@/state/editorStore';
import type { Zoom } from './EditorCanvas';
import { ExportMenu } from './ExportMenu';
import { SaveStatus } from './SaveStatus';
import styles from './EditorToolbar.module.css';

interface EditorToolbarProps {
  zoom: Zoom;
  onZoomChange: (zoom: Zoom) => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onSave: () => void;
}

function DesignName() {
  const name = useEditorStore((s) => s.document?.name ?? '');
  const renameDocument = useEditorStore((s) => s.renameDocument);
  const [draft, setDraft] = useState(name);
  const [synced, setSynced] = useState(name);
  if (name !== synced) {
    setSynced(name);
    setDraft(name);
  }
  const commit = () => {
    const r = renameDocument(draft);
    if (!r.ok) {
      toast.error(r.reason);
      setDraft(name);
    }
  };
  return (
    <input
      className={styles.name}
      value={draft}
      aria-label="Design name"
      maxLength={120}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(name);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function EditorToolbar({ zoom, onZoomChange, leftOpen, rightOpen, onToggleLeft, onToggleRight, onSave }: EditorToolbarProps) {
  const mode = useEditorStore((s) => s.mode);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const { undo, redo, setMode, addPage } = useEditorStore.getState();
  const editing = mode === 'edit';

  return (
    <header className={styles.toolbar}>
      <div className={styles.left}>
        <Link to="/" className={styles.brand} aria-label="BI Design Studio home">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--app-accent)" />
            <rect x="7" y="17" width="4" height="8" rx="1" fill="#fff" />
            <rect x="14" y="11" width="4" height="14" rx="1" fill="#fff" />
            <rect x="21" y="7" width="4" height="18" rx="1" fill="#a9bcff" />
          </svg>
        </Link>
        <Link to="/gallery" className={styles.crumb}>
          Gallery
        </Link>
        <span className={styles.sep} aria-hidden="true">
          /
        </span>
        <DesignName />
        <SaveStatus />
      </div>

      <div className={styles.right}>
        {editing && (
          <>
            <IconButton label={leftOpen ? 'Hide left panel' : 'Show left panel'} icon={<PanelLeft size={18} />} active={leftOpen} onClick={onToggleLeft} />
            <IconButton label={rightOpen ? 'Hide properties panel' : 'Show properties panel'} icon={<PanelRight size={18} />} active={rightOpen} onClick={onToggleRight} />
            <span className={styles.divider} aria-hidden="true" />
            <IconButton label="Undo (Ctrl+Z)" icon={<Undo2 size={18} />} disabled={!canUndo} onClick={undo} />
            <IconButton label="Redo (Ctrl+Shift+Z)" icon={<Redo2 size={18} />} disabled={!canRedo} onClick={redo} />
            <span className={styles.divider} aria-hidden="true" />
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => {
                const r = addPage();
                if (!r.ok) toast.error(r.reason);
              }}
            >
              Add page
            </Button>
            <label className={styles.zoom}>
              <span className="sr-only">Zoom</span>
              <select value={String(zoom)} onChange={(e) => onZoomChange(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}>
                <option value="fit">Fit</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">100%</option>
              </select>
            </label>
          </>
        )}
        <div className={styles.modeSwitch} role="group" aria-label="Mode">
          <button type="button" aria-pressed={editing} onClick={() => setMode('edit')}>
            <Pencil size={14} aria-hidden="true" /> Edit
          </button>
          <button type="button" aria-pressed={!editing} onClick={() => setMode('preview')}>
            <Eye size={14} aria-hidden="true" /> Preview
          </button>
        </div>
        <ExportMenu />
        <Button variant="primary" size="sm" icon={<Save size={15} aria-hidden="true" />} onClick={onSave}>
          Save
        </Button>
      </div>
    </header>
  );
}
