import { useParams } from 'react-router';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { ButtonLink } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { DashboardPreview } from '@/components/dashboard/DashboardPreview';
import { CategoryIcon } from '@/components/gallery/CategoryIcon';
import { UseTemplateButton } from '@/components/gallery/UseTemplateButton';
import { ThemeSwatches } from '@/components/themes/ThemeSwatches';
import { VISUAL_ICONS } from '@/components/visuals/visualIcons';
import { getLayoutPreset } from '@/data/layoutPresets';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { templateRepository } from '@/services/templateService';
import { themeRepository } from '@/services/themeService';
import page from './Page.module.css';
import styles from './TemplateDetailPage.module.css';

export function TemplateDetailPage() {
  const { templateId = '' } = useParams();
  const summary = templateRepository.get(templateId);

  if (!summary) {
    return (
      <div className={page.page}>
        <EmptyState
          icon={<FileQuestion size={22} aria-hidden="true" />}
          title="Template not found"
          description="This design may have been renamed or removed from the gallery."
          action={
            <ButtonLink to="/gallery" variant="primary">
              Back to gallery
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const { template, category, pageCount, visualTypes } = summary;
  const theme = themeRepository.get(template.themeId);
  const layout = getLayoutPreset(template.layoutPresetId);

  return (
    <div className={`${page.page} ${styles.wide}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.category}>
            <CategoryIcon icon={category?.icon} size={14} />
            {category?.name}
          </div>
          <h1 className={styles.title}>{template.name}</h1>
          <p className={styles.description}>{template.description}</p>
        </div>
        <div className={styles.headerActions}>
          <ButtonLink to="/gallery" variant="secondary" size="lg" icon={<ArrowLeft size={18} aria-hidden="true" />}>
            Back to gallery
          </ButtonLink>
          <UseTemplateButton templateId={template.id} />
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.previewCol} aria-label="Dashboard preview">
          <DashboardPreview document={template.document} />
        </section>

        <aside className={styles.aside} aria-label="Template details">
          <dl className={styles.facts}>
            <div>
              <dt>Intended audience</dt>
              <dd>{template.audience}</dd>
            </div>
            <div>
              <dt>Purpose</dt>
              <dd>{template.purpose}</dd>
            </div>
            <div>
              <dt>Pages</dt>
              <dd>
                {pageCount} {pageCount === 1 ? 'page' : 'pages'}: {template.document.pages.map((p) => p.name).join(', ')}
              </dd>
            </div>
            <div>
              <dt>Included KPIs</dt>
              <dd>
                <ul className={styles.pills}>
                  {template.kpis.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Visual types</dt>
              <dd>
                <ul className={styles.visualTypes}>
                  {visualTypes.map((t) => {
                    const Icon = VISUAL_ICONS[t];
                    return (
                      <li key={t}>
                        <Icon size={14} aria-hidden="true" />
                        {getVisualDefinition(t).label}
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
            {theme && (
              <div>
                <dt>Theme</dt>
                <dd className={styles.themeRow}>
                  <ThemeSwatches tokens={theme.tokens} />
                  <span>{theme.name}</span>
                </dd>
              </div>
            )}
            {layout && (
              <div>
                <dt>Layout</dt>
                <dd>
                  <strong className={styles.layoutName}>{layout.name}</strong> — {layout.description}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}
