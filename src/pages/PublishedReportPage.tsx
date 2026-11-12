import { useParams } from 'react-router';
import { ArrowLeft, Download, ExternalLink, FileQuestion, Loader2 } from 'lucide-react';
import { ButtonLink } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { CategoryIcon } from '@/components/gallery/CategoryIcon';
import { templateRepository } from '@/services/templateService';
import { usePublishedItems } from '@/services/published/usePublishedItems';
import page from './Page.module.css';
import styles from './PublishedReportPage.module.css';

/**
 * A published .pbix report shown inside the portal through its Power BI
 * "Publish to web" link (rendered by the Power BI service in an iframe).
 */
export function PublishedReportPage() {
  const { itemId = '' } = useParams();
  const state = usePublishedItems();

  if (state.status === 'loading') {
    return (
      <div className={page.page}>
        <p className={styles.status} role="status">
          <Loader2 size={16} className={styles.spin} aria-hidden="true" /> Loading…
        </p>
      </div>
    );
  }

  const item = state.status === 'ready' ? state.items.find((i) => i.id === itemId) : undefined;
  if (!item || !item.embedUrl) {
    return (
      <div className={page.page}>
        <EmptyState
          icon={<FileQuestion size={22} aria-hidden="true" />}
          title={item ? 'This report cannot be opened in the portal' : 'Report not found'}
          description={
            state.status === 'error'
              ? state.message
              : item
                ? 'It has no Power BI “Publish to web” link yet. You can still download it and open it in Power BI Desktop.'
                : 'It may have been removed from the gallery.'
          }
          action={
            <ButtonLink to="/gallery" variant="primary">
              Back to gallery
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const category = item.categoryId ? templateRepository.getCategory(item.categoryId) : undefined;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.category}>
            {category && <CategoryIcon icon={category.icon} size={14} />}
            {category?.name ?? 'Power BI report'}
          </div>
          <h1 className={styles.title}>{item.title}</h1>
          {item.description && <p className={styles.description}>{item.description}</p>}
        </div>
        <div className={styles.actions}>
          <ButtonLink to="/gallery" variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />}>
            Back to gallery
          </ButtonLink>
          <a className={styles.secondaryLink} href={item.embedUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" /> Open in Power BI
          </a>
          {item.downloadable && (
            <a className={styles.primaryLink} href={`/${item.file.path}`} download={item.file.name}>
              <Download size={16} aria-hidden="true" /> Download .pbix
            </a>
          )}
        </div>
      </header>
      <div className={styles.frame}>
        <iframe title={`${item.title} (Power BI report)`} src={item.embedUrl} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <p className={styles.note}>Shown by the Power BI service through a public “Publish to web” link. Its data comes from the publisher’s report, not from the studio’s sample data.</p>
    </div>
  );
}
