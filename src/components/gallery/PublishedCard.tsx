import { Link } from 'react-router';
import { BarChart3, Eye, Lock, Puzzle } from 'lucide-react';
import type { PublishedItem } from '@/domain/schemas/published';
import { templateRepository } from '@/services/templateService';
import { formatBytes } from '@/services/published/manifest';
import { CategoryIcon } from './CategoryIcon';
import { FileRequestButton } from './FileRequestButton';
import styles from './PublishedCard.module.css';

const KIND_LABEL = { pbix: 'Power BI report', pbiviz: 'Custom visual' } as const;

/** A Power BI file published by the site owner: picture, details and a download link. */
export function PublishedCard({ item }: { item: PublishedItem }) {
  const category = item.categoryId ? templateRepository.getCategory(item.categoryId) : undefined;
  const KindIcon = item.kind === 'pbix' ? BarChart3 : Puzzle;
  return (
    <article className={styles.card} data-testid="published-card">
      <div className={styles.preview} data-kind={item.kind}>
        {item.preview ? <img src={`/${item.preview.path}`} alt={`Preview of ${item.title}`} loading="lazy" /> : <KindIcon size={40} strokeWidth={1.5} aria-hidden="true" />}
        <span className={styles.badge}>
          <KindIcon size={13} aria-hidden="true" />
          {KIND_LABEL[item.kind]} (.{item.kind})
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={styles.category}>
            {category ? (
              <>
                <CategoryIcon icon={category.icon} size={13} />
                {category.name}
              </>
            ) : (
              'Power BI'
            )}
          </span>
          <span>
            {item.visual ? `v${item.visual.version} · ` : ''}
            {formatBytes(item.file.size)}
          </span>
        </div>
        <h3 className={styles.name}>{item.title}</h3>
        {item.description && <p className={styles.description}>{item.description}</p>}
        {item.tags.length > 0 && (
          <ul className={styles.tags} aria-label="Tags">
            {item.tags.slice(0, 4).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          {item.embedUrl && (
            <Link className={styles.download} to={`/gallery/files/${item.id}`}>
              <Eye size={15} aria-hidden="true" />
              Open report
            </Link>
          )}
          {item.downloadable ? (
            <FileRequestButton item={item} className={item.embedUrl ? styles.secondary : styles.download} label={item.embedUrl ? 'Download' : `Download ${item.file.name}`} />
          ) : (
            <p className={styles.noDownload}>
              <Lock size={14} aria-hidden="true" />
              Shown for reference; download is not offered.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
