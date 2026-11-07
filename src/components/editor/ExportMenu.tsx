import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileArchive, FileCode2, FileJson, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/common/toastStore';
import { projectFolderName } from '@/services/export/pbip/names';
import { downloadFile, exportHandoffJson, exportHtml, exportPbip } from '@/services/export/exportService';
import { useEditorStore } from '@/state/editorStore';
import styles from './ExportMenu.module.css';

type Busy = null | 'html' | 'json' | 'pbip';

async function exportAs(kind: Exclude<Busy, null>, doc: Parameters<typeof exportPbip>[0]) {
  if (kind === 'html') return { ...(await exportHtml(doc)), mime: 'text/html' };
  if (kind === 'pbip') return { ...(await exportPbip(doc)), mime: 'application/zip' };
  return { ...exportHandoffJson(doc), mime: 'application/json' };
}

/** Download the design: a standalone HTML page, a Power BI handoff JSON, or a Power BI project (PBIP). */
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [pbipHelp, setPbipHelp] = useState<{ zip: string; project: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const run = async (kind: Exclude<Busy, null>) => {
    const doc = useEditorStore.getState().document;
    if (!doc) return;
    setOpen(false);
    setBusy(kind);
    try {
      const file = await exportAs(kind, doc);
      downloadFile(file.filename, file.content, file.mime);
      toast.success(`Downloaded ${file.filename}`);
      // A PBIP is a folder: opening the .pbip from inside the zip (without extracting) fails in Power BI Desktop.
      if (kind === 'pbip') setPbipHelp({ zip: file.filename, project: projectFolderName(doc.name) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(wrapRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        icon={busy ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
        iconRight={<ChevronDown size={14} aria-hidden="true" />}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy !== null}
        onClick={() => setOpen((v) => !v)}
      >
        {busy ? 'Exporting…' : 'Export'}
      </Button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Export" onKeyDown={onMenuKey}>
          <button ref={firstItemRef} type="button" role="menuitem" className={styles.item} onClick={() => void run('html')}>
            <FileCode2 size={18} aria-hidden="true" className={styles.icon} />
            <span>
              <span className={styles.title}>HTML page</span>
              <span className={styles.text}>Every page as a picture plus the full specification, in one file that opens offline.</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => void run('json')}>
            <FileJson size={18} aria-hidden="true" className={styles.icon} />
            <span>
              <span className={styles.title}>Power BI handoff (JSON)</span>
              <span className={styles.text}>Structured spec for a Power BI developer or AI agent: visuals, positions, fields, formats and theme. Includes the full design.</span>
            </span>
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => void run('pbip')}>
            <FileArchive size={18} aria-hidden="true" className={styles.icon} />
            <span>
              <span className={styles.title}>Power BI project (PBIP)</span>
              <span className={styles.text}>
                A .zip to open in Power BI Desktop (June 2025 or later): pages, visuals, theme and a sample-data model to replace with real data.
              </span>
            </span>
          </button>
          <p className={styles.note}>All figures stay fictional sample data. Open the PBIP project in Power BI Desktop; to publish, use Publish or save it as .pbix there (renaming the file does not convert it).</p>
        </div>
      )}
      <ConfirmDialog
        open={pbipHelp !== null}
        title="Extract the zip before opening it"
        confirmLabel="Got it"
        tone="primary"
        hideCancel
        onConfirm={() => setPbipHelp(null)}
        onCancel={() => setPbipHelp(null)}
      >
        {pbipHelp && (
          <>
            <p>A Power BI project is a folder, not a single file. Power BI Desktop can’t open it from inside the zip: Windows would copy out only the .pbip file, and Power BI then reports that “definition.pbir” is missing.</p>
            <ol className={styles.steps}>
              <li>
                Right-click <strong>{pbipHelp.zip}</strong> and choose <strong>Extract All…</strong>
              </li>
              <li>
                Extract to a short path such as <code>C:\PBI\</code> (Windows limits paths to 260 characters).
              </li>
              <li>
                Open <strong>{`${pbipHelp.project}\\${pbipHelp.project}.pbip`}</strong> from the extracted folder in Power BI Desktop.
              </li>
            </ol>
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}
