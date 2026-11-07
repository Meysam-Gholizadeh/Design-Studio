import { DashboardPageView } from '@/components/dashboard/DashboardPageView';
import { ScaledFrame } from '@/components/dashboard/ScaledFrame';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { useEditorStore } from '@/state/editorStore';
import styles from './EditorPreview.module.css';

/** Read-only, interactive preview of the design being edited (no editing possible here). */
export function EditorPreview() {
  const document = useEditorStore((s) => s.document)!;
  const activePageId = useEditorStore((s) => s.activePageId);
  const setActivePage = useEditorStore((s) => s.setActivePage);
  const index = Math.max(0, document.pages.findIndex((p) => p.id === activePageId));

  return (
    <div className={styles.preview} data-testid="editor-preview">
      <div className={styles.bar}>
        {document.pages.length > 1 ? (
          <div role="tablist" aria-label="Dashboard pages" className={styles.tabs}>
            {document.pages.map((p) => (
              <button key={p.id} role="tab" type="button" aria-selected={p.id === activePageId} className={styles.tab} onClick={() => setActivePage(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.pageName}>{document.pages[0]?.name}</span>
        )}
        <span className={styles.note}>Preview — press Esc or choose Edit to keep editing</span>
        <SampleDataNotice compact imported={document.source?.kind === 'html-import'} />
      </div>
      <div className={styles.stage}>
        <ScaledFrame width={document.canvas.width} height={document.canvas.height} fit="contain">
          <DashboardPageView document={document} pageIndex={index} mode="preview" />
        </ScaledFrame>
      </div>
    </div>
  );
}
