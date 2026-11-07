import { Link } from 'react-router';
import { Layers } from 'lucide-react';
import type { TemplateSummary } from '@/services/templateService';
import { CategoryIcon } from './CategoryIcon';
import { TemplateThumbnail } from './TemplateThumbnail';
import styles from './TemplateCard.module.css';

export function TemplateCard({ summary }: { summary: TemplateSummary }) {
  const { template, category, pageCount } = summary;
  return (
    <article className={styles.card} data-testid="template-card">
      <Link to={`/gallery/${template.id}`} className={styles.link} aria-label={`Preview ${template.name}`}>
        <TemplateThumbnail document={template.document} />
        <div className={styles.body}>
          <div className={styles.meta}>
            <span className={styles.category}>
              <CategoryIcon icon={category?.icon} size={13} />
              {category?.name}
            </span>
            <span className={styles.pages}>
              <Layers size={13} aria-hidden="true" />
              {pageCount} {pageCount === 1 ? 'page' : 'pages'}
            </span>
          </div>
          <h3 className={styles.name}>{template.name}</h3>
          <p className={styles.description}>{template.description}</p>
          <ul className={styles.tags} aria-label="Key KPIs">
            {template.kpis.slice(0, 3).map((k) => (
              <li key={k}>{k}</li>
            ))}
            {template.kpis.length > 3 && <li className={styles.more}>+{template.kpis.length - 3}</li>}
          </ul>
          <span className={styles.cta}>Preview</span>
        </div>
      </Link>
    </article>
  );
}
