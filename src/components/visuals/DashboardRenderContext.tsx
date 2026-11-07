import { useMemo, type ReactNode } from 'react';
import type { ResolvedTheme } from '@/services/themeService';
import { DashboardRenderContext, type DashboardRenderContextValue, type RenderMode } from './renderContext';

export function DashboardRenderProvider({ theme, mode, children }: { theme: ResolvedTheme; mode: RenderMode; children: ReactNode }) {
  const value = useMemo<DashboardRenderContextValue>(
    () => ({ theme, mode, chart: { animate: mode !== 'thumbnail', interactive: mode === 'preview' } }),
    [theme, mode],
  );
  return <DashboardRenderContext.Provider value={value}>{children}</DashboardRenderContext.Provider>;
}
