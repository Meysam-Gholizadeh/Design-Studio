import type { DashboardComponent } from '@/domain/schemas/visuals';
import { getVisualDefinition } from '@/domain/visualDefinitions';

/** Human-readable name of a visual for layers, labels and messages. */
export function componentDisplayName(c: DashboardComponent): string {
  if (c.type === 'text') return c.data.text.split('\n')[0]?.slice(0, 60) || 'Text';
  if (c.type === 'kpi') return c.config.label || c.title || 'KPI card';
  return c.title || getVisualDefinition(c.type).label;
}
