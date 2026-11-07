import { useId, useState, type KeyboardEvent } from 'react';
import type { DashboardDocument } from '@/domain/schemas/document';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { DashboardPageView } from './DashboardPageView';
import { ScaledFrame } from './ScaledFrame';
import styles from './DashboardPreview.module.css';

interface DashboardPreviewProps {
  document: DashboardDocument;
  /** Render with a different theme without changing the document. */
  themeId?: string;
  /** Controlled page index (optional). */
  pageIndex?: number;
  onPageChange?: (index: number) => void;
}

/** Full-width, read-only, interactive preview of a dashboard with page tabs. */
export function DashboardPreview({ document, themeId, pageIndex, onPageChange }: DashboardPreviewProps) {
  const [internalPage, setInternalPage] = useState(0);
  const current = Math.min(pageIndex ?? internalPage, document.pages.length - 1);
  const setPage = (i: number) => {
    setInternalPage(i);
    onPageChange?.(i);
  };
  const tabsId = useId();

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = document.pages.length;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (current + 1) % n;
    else if (e.key === 'ArrowLeft') next = (current - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setPage(next);
    window.document.getElementById(`${tabsId}-tab-${next}`)?.focus();
  };

  return (
    <div className={styles.preview}>
      <div className={styles.toolbar}>
        {document.pages.length > 1 ? (
          <div role="tablist" aria-label="Dashboard pages" className={styles.tabs}>
            {document.pages.map((p, i) => (
              <button
                key={p.id}
                id={`${tabsId}-tab-${i}`}
                role="tab"
                type="button"
                aria-selected={i === current}
                aria-controls={`${tabsId}-panel`}
                tabIndex={i === current ? 0 : -1}
                className={styles.tab}
                onClick={() => setPage(i)}
                onKeyDown={onTabKey}
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.singlePage}>{document.pages[0]?.name}</div>
        )}
        <SampleDataNotice imported={document.source?.kind === 'html-import'} />
      </div>
      <div id={`${tabsId}-panel`} role={document.pages.length > 1 ? 'tabpanel' : undefined} className={styles.stage}>
        <ScaledFrame width={document.canvas.width} height={document.canvas.height}>
          <DashboardPageView document={document} pageIndex={current} mode="preview" themeId={themeId} />
        </ScaledFrame>
      </div>
    </div>
  );
}
