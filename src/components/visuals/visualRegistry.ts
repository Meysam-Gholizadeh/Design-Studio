import type { ComponentType } from 'react';
import type { ComponentOfType, VisualType } from '@/domain/schemas/visuals';
import { BarVisual, ComboVisual, LineVisual, SliceVisual } from './ChartVisuals';
import { DividerVisual, ImageVisual, TextVisual } from './ContentVisuals';
import { GaugeVisual } from './GaugeVisual';
import { KpiVisual } from './KpiVisual';
import { SlicerVisual } from './SlicerVisual';
import { TableVisual } from './TableVisual';

export type VisualRendererComponent<T extends VisualType> = ComponentType<{ component: ComponentOfType<T> }>;

/**
 * Maps each visual type to its renderer. Adding a visual type means adding a
 * schema, a definition and one entry here — the editor needs no changes.
 */
export const visualRegistry: { [K in VisualType]: VisualRendererComponent<K> } = {
  kpi: KpiVisual,
  bar: BarVisual,
  stackedBar: BarVisual,
  line: LineVisual,
  area: LineVisual,
  combo: ComboVisual,
  pie: SliceVisual,
  donut: SliceVisual,
  table: TableVisual,
  gauge: GaugeVisual,
  slicer: SlicerVisual,
  text: TextVisual,
  image: ImageVisual,
  divider: DividerVisual,
};
