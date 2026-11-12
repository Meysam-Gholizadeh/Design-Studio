import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { DashboardComponent, VisualType } from '@/domain/schemas/visuals';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { cardTheme } from './cardTheme';
import { DashboardRenderProvider } from './DashboardRenderContext';
import { useDashboardRender } from './renderContext';
import { VisualFrame } from './VisualFrame';
import { visualRegistry, type VisualRendererComponent } from './visualRegistry';
import styles from './VisualRenderer.module.css';

function VisualError() {
  return (
    <div className={styles.error} role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>This visual couldn’t be displayed.</span>
    </div>
  );
}

/**
 * Renders any dashboard component through the registry, inside its card frame
 * and an error boundary so one broken visual never takes down the page.
 */
export const VisualRenderer = memo(function VisualRenderer({ component }: { component: DashboardComponent }) {
  const Renderer = visualRegistry[component.type] as VisualRendererComponent<VisualType> | undefined;
  const { theme, mode } = useDashboardRender();
  const content = (
    <ErrorBoundary resetKey={component} fallback={() => <VisualError />}>
      {Renderer ? <Renderer component={component as never} /> : <VisualError />}
    </ErrorBoundary>
  );
  return (
    <VisualFrame component={component}>
      {/* A card with its own text colour gives its content (charts included) matching theme tokens. */}
      {component.style.textColor ? (
        <DashboardRenderProvider theme={cardTheme(theme, component.style)} mode={mode}>
          {content}
        </DashboardRenderProvider>
      ) : (
        content
      )}
    </VisualFrame>
  );
});
