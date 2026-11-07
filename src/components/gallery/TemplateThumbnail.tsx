import type { DashboardDocument } from '@/domain/schemas/document';
import { LazyMount } from '@/components/common/LazyMount';
import { DashboardPageView } from '@/components/dashboard/DashboardPageView';
import { ScaledFrame } from '@/components/dashboard/ScaledFrame';
import styles from './TemplateThumbnail.module.css';

/** Real, rendered mini dashboard (first page) — not a static image. */
export function TemplateThumbnail({ document }: { document: DashboardDocument }) {
  const ratio = `${document.canvas.width} / ${document.canvas.height}`;
  return (
    <div className={styles.thumb} aria-hidden="true">
      <LazyMount placeholder={<div className={styles.placeholder} style={{ aspectRatio: ratio }} />}>
        <ScaledFrame width={document.canvas.width} height={document.canvas.height}>
          <DashboardPageView document={document} mode="thumbnail" />
        </ScaledFrame>
      </LazyMount>
    </div>
  );
}
