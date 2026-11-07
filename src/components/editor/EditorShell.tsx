import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { ButtonLink } from '@/components/common/Button';
import { DashboardPreview } from '@/components/dashboard/DashboardPreview';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useEditorStore } from '@/state/editorStore';
import { EditorCanvas, type Zoom } from './EditorCanvas';
import { EditorPreview } from './EditorPreview';
import { EditorToolbar } from './EditorToolbar';
import { LeftPanel } from './LeftPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { useAutosave } from './useAutosave';
import { useEditorShortcuts } from './useEditorShortcuts';
import styles from './EditorShell.module.css';

/** Three-column editor: library/pages/layers · canvas · properties. */
export function EditorShell() {
  const document = useEditorStore((s) => s.document)!;
  const mode = useEditorStore((s) => s.mode);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const saveNow = useAutosave();
  useEditorShortcuts(() => void saveNow());

  useEffect(() => {
    const previous = window.document.title;
    window.document.title = `${document.name} — BI Design Studio`;
    return () => {
      window.document.title = previous;
    };
  }, [document.name]);

  const editing = mode === 'edit';
  const narrow = useMediaQuery('(max-width: 900px)');

  if (narrow) {
    // The three-panel editor would be unusable here, so offer a read-only view.
    return (
      <div className={styles.narrow}>
        <div className={styles.narrowNotice}>
          <Monitor size={22} aria-hidden="true" />
          <div>
            <p className={styles.narrowTitle}>Editing needs a larger screen</p>
            <p>Open this design on a desktop or widen your window to edit it. Your design is saved in this browser.</p>
          </div>
        </div>
        <DashboardPreview document={document} />
        <ButtonLink to="/" variant="secondary">
          Back to Home
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <div className={styles.shell} data-left={editing && leftOpen ? 'open' : 'closed'} data-right={editing && rightOpen ? 'open' : 'closed'}>
        <EditorToolbar
          zoom={zoom}
          onZoomChange={setZoom}
          leftOpen={leftOpen}
          rightOpen={rightOpen}
          onToggleLeft={() => setLeftOpen((v) => !v)}
          onToggleRight={() => setRightOpen((v) => !v)}
          onSave={() => void saveNow()}
        />
        {editing && leftOpen && (
          <div className={styles.left}>
            <LeftPanel />
          </div>
        )}
        <main className={styles.center}>{editing ? <EditorCanvas zoom={zoom} /> : <EditorPreview />}</main>
        {editing && rightOpen && (
          <aside className={styles.right} aria-label="Properties">
            <PropertiesPanel />
          </aside>
        )}
      </div>
    </>
  );
}
