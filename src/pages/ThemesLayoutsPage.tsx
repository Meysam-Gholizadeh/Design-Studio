import { useState } from 'react';
import { SquarePlus } from 'lucide-react';
import { ButtonLink } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { DashboardPreview } from '@/components/dashboard/DashboardPreview';
import { ApplyThemeToDesign } from '@/components/themes/ApplyThemeToDesign';
import { LayoutWireframe } from '@/components/themes/LayoutWireframe';
import { ThemePicker } from '@/components/themes/ThemePicker';
import { LAYOUT_PRESETS } from '@/data/layoutPresets';
import { SHOWCASE_DOCUMENT } from '@/data/sample/showcaseDocument';
import { themeRepository } from '@/services/themeService';
import page from './Page.module.css';
import styles from './ThemesLayoutsPage.module.css';

/**
 * Themes (how a dashboard looks) and layouts (how it is arranged), shown as
 * two separate libraries. Either can start a new design or be applied in the editor.
 */
export function ThemesLayoutsPage() {
  const themes = themeRepository.list();
  const [themeId, setThemeId] = useState(themes[0]!.id);
  const theme = themes.find((t) => t.id === themeId) ?? themes[0]!;

  return (
    <div className={page.page}>
      <PageHeader
        title="Themes & Layouts"
        description={
          <>
            A <strong>theme</strong> changes how a dashboard looks — colours, surfaces, fonts and chart palette — without moving anything. A <strong>layout</strong>{' '}
            changes where visuals sit on the page — without changing how they look. Combine any theme with any layout.
          </>
        }
      />

      <section aria-labelledby="themes-title">
        <h2 id="themes-title" className={page.sectionTitle}>
          Themes
        </h2>
        <p className={page.sectionDescription}>Pick a theme to see it on a live sample dashboard below.</p>
        <ThemePicker name="library-theme" themes={themes} value={themeId} onChange={setThemeId} />

        <div className={styles.previewHead}>
          <h3 className={styles.previewTitle}>{theme.name} on a sample dashboard</h3>
          <div className={styles.previewActions}>
            <ApplyThemeToDesign themeId={theme.id} themeName={theme.name} />
            <ButtonLink to={`/editor/new?theme=${theme.id}`} variant="primary" icon={<SquarePlus size={16} aria-hidden="true" />}>
              New design with {theme.name}
            </ButtonLink>
          </div>
        </div>
        <DashboardPreview document={SHOWCASE_DOCUMENT} themeId={theme.id} />
      </section>

      <section className={page.section} aria-labelledby="layouts-title">
        <h2 id="layouts-title" className={page.sectionTitle}>
          Layouts
        </h2>
        <p className={page.sectionDescription}>
          Ready-made page arrangements. Start a new design with one (filled with sample visuals, in the {theme.name} theme), or in the editor choose a layout for any page:
          existing visuals are moved into place and nothing is deleted.
        </p>
        <ul className={styles.layoutGrid}>
          {LAYOUT_PRESETS.map((preset) => (
            <li key={preset.id} className={styles.layoutCard}>
              <div className={styles.wire}>
                <LayoutWireframe preset={preset} showLabels />
              </div>
              <div className={styles.layoutMeta}>
                <h3 className={styles.layoutName}>{preset.name}</h3>
                <p className={styles.layoutDescription}>{preset.description}</p>
                <p className={styles.bestFor}>Best for: {preset.bestFor}</p>
                <ButtonLink to={`/editor/new?layout=${preset.id}&theme=${theme.id}`} size="sm" icon={<SquarePlus size={15} aria-hidden="true" />}>
                  Start with this layout
                </ButtonLink>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
