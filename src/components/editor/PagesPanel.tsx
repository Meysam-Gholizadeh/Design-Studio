import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/common/toastStore';
import { useEditorStore } from '@/state/editorStore';
import styles from './PagesPanel.module.css';

const NO_PAGES: never[] = [];

export function PagesPanel() {
  const pages = useEditorStore((s) => s.document?.pages ?? NO_PAGES);
  const activePageId = useEditorStore((s) => s.activePageId);
  const { setActivePage, addPage, renamePage, duplicatePage, deletePage, movePage } = useEditorStore.getState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const report = (r: { ok: boolean; reason?: string }) => {
    if (!r.ok && r.reason) toast.error(r.reason);
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };

  const finishRename = () => {
    if (editingId) report(renamePage(editingId, draft));
    setEditingId(null);
  };

  const pageToDelete = pages.find((p) => p.id === pendingDelete);

  return (
    <div className={styles.panel}>
      <ol className={styles.list} aria-label="Pages">
        {pages.map((p, i) => {
          const active = p.id === activePageId;
          return (
            <li key={p.id} className={styles.row} data-active={active || undefined}>
              {editingId === p.id ? (
                <input
                  className={styles.renameInput}
                  value={draft}
                  aria-label="Page name"
                  autoFocus
                  maxLength={120}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={finishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.pageButton}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setActivePage(p.id)}
                  onDoubleClick={() => startRename(p.id, p.name)}
                >
                  <FileText size={15} aria-hidden="true" />
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.count}>{p.components.length}</span>
                </button>
              )}
              <div className={styles.actions}>
                <IconButton size="sm" label={`Rename ${p.name}`} icon={<Pencil size={14} />} onClick={() => startRename(p.id, p.name)} />
                <IconButton size="sm" label={`Duplicate ${p.name}`} icon={<Copy size={14} />} onClick={() => report(duplicatePage(p.id))} />
                <IconButton size="sm" label={`Move ${p.name} up`} icon={<ArrowUp size={14} />} disabled={i === 0} onClick={() => movePage(p.id, -1)} />
                <IconButton
                  size="sm"
                  label={`Move ${p.name} down`}
                  icon={<ArrowDown size={14} />}
                  disabled={i === pages.length - 1}
                  onClick={() => movePage(p.id, 1)}
                />
                <IconButton
                  size="sm"
                  label={`Delete ${p.name}`}
                  icon={<Trash2 size={14} />}
                  disabled={pages.length <= 1}
                  title={pages.length <= 1 ? 'A dashboard needs at least one page' : `Delete ${p.name}`}
                  onClick={() => setPendingDelete(p.id)}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="secondary" size="sm" icon={<Plus size={15} aria-hidden="true" />} className={styles.add} onClick={() => report(addPage())}>
        Add page
      </Button>

      <ConfirmDialog
        open={Boolean(pageToDelete)}
        title={`Delete “${pageToDelete?.name ?? ''}”?`}
        confirmLabel="Delete page"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) report(deletePage(pendingDelete));
          setPendingDelete(null);
        }}
      >
        {pageToDelete && pageToDelete.components.length > 0
          ? `This page and its ${pageToDelete.components.length} visual${pageToDelete.components.length === 1 ? '' : 's'} will be removed. You can undo this.`
          : 'This empty page will be removed. You can undo this.'}
      </ConfirmDialog>
    </div>
  );
}
