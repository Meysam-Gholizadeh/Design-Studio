import { createContext, useContext } from 'react';
import type { ResolvedTheme } from '@/services/themeService';
import type { ChartRenderOptions } from './charts/chartOptions';

/**
 * How a dashboard is being displayed:
 * - thumbnail: gallery card, static, no animation or tooltips
 * - preview:   read-only full view, interactive tooltips and controls
 * - edit:      editor canvas, controls inside visuals are inert so drag/select works
 */
export type RenderMode = 'thumbnail' | 'preview' | 'edit';

export interface DashboardRenderContextValue {
  theme: ResolvedTheme;
  mode: RenderMode;
  chart: ChartRenderOptions;
}

export const DashboardRenderContext = createContext<DashboardRenderContextValue | null>(null);

export function useDashboardRender(): DashboardRenderContextValue {
  const v = useContext(DashboardRenderContext);
  if (!v) throw new Error('useDashboardRender must be used inside <DashboardRenderProvider>');
  return v;
}
