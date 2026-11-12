import { useMemo, type CSSProperties } from 'react';
import type { DashboardDocument } from '@/domain/schemas/document';
import { resolveTheme, themeToCssVars } from '@/services/themeService';
import { DashboardRenderProvider } from '@/components/visuals/DashboardRenderContext';
import type { RenderMode } from '@/components/visuals/renderContext';
import { VisualRenderer } from '@/components/visuals/VisualRenderer';
import { pageBackgroundImageStyle } from './pageBackground';
import { pixelRect, positionParamsFor } from './pageGeometry';
import styles from './DashboardPageView.module.css';

interface DashboardPageViewProps {
  document: DashboardDocument;
  pageIndex?: number;
  mode: Exclude<RenderMode, 'edit'>;
  /** Override the document theme (used for theme previews without mutating the document). */
  themeId?: string;
}

/**
 * Read-only rendering of one dashboard page at its design size. Used by the
 * gallery thumbnails, template preview and theme previews; the editor canvas
 * uses the same VisualRenderer and grid math.
 */
export function DashboardPageView({ document, pageIndex = 0, mode, themeId }: DashboardPageViewProps) {
  const page = document.pages[Math.min(pageIndex, document.pages.length - 1)];
  const theme = useMemo(
    () => resolveTheme(themeId ?? document.themeId, themeId ? undefined : document.themeOverrides),
    [themeId, document.themeId, document.themeOverrides],
  );
  const params = useMemo(() => (page ? positionParamsFor(document.canvas, page.grid) : null), [document.canvas, page]);

  if (!page || !params) return null;

  const rootStyle = {
    ...themeToCssVars(theme.tokens, document.canvas.background),
    ...pageBackgroundImageStyle(document.canvas),
    width: document.canvas.width,
    height: document.canvas.height,
  } as CSSProperties;

  return (
    <DashboardRenderProvider theme={theme} mode={mode}>
      <div className={styles.page} style={rootStyle} data-theme-mode={theme.mode} aria-label={`${document.name} — ${page.name}`} role="group">
        {page.components
          .filter((c) => !c.hidden)
          .map((c) => {
            const r = pixelRect(params, c.layout);
            return (
              <div key={c.id} className={styles.item} style={{ left: r.left, top: r.top, width: r.width, height: r.height }}>
                <VisualRenderer component={c} />
              </div>
            );
          })}
      </div>
    </DashboardRenderProvider>
  );
}
