import { useMemo } from 'react';
import { matchesPublished, usePublishedItems } from '@/services/published/usePublishedItems';
import { PublishedCard } from './PublishedCard';
import page from '@/pages/Page.module.css';
import styles from '@/pages/GalleryPage.module.css';

/** Gallery section for the .pbix reports and .pbiviz visuals published from the admin page. Hidden when none match. */
export function PublishedSection({ text, categoryId }: { text: string; categoryId: string | null }) {
  const state = usePublishedItems();
  const items = useMemo(() => (state.status === 'ready' ? state.items.filter((i) => matchesPublished(i, text, categoryId)) : []), [state, text, categoryId]);

  if (state.status === 'error') {
    return (
      <p className={styles.publishedError} role="status">
        {state.message}
      </p>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className={page.section} aria-labelledby="published-title" data-testid="published-section">
      <h2 id="published-title" className={page.sectionTitle}>
        Power BI files
      </h2>
      <p className={page.sectionDescription}>
        Ready-made Power BI reports (.pbix) and custom visuals (.pbiviz). Download a file and open it in Power BI Desktop. Their contents come from the publisher’s file, not from the
        studio’s sample data.
      </p>
      <div className={styles.grid}>
        {items.map((item) => (
          <PublishedCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
