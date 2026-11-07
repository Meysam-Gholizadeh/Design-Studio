/**
 * Layout presets: page compositions made of typed slots on the 12-column
 * grid, designed for a standard 1440 × 900 page (24 rows). A layout changes
 * where visuals sit — never their data or styling (that is the theme's job).
 *
 * Each slot has a role (what belongs there) and the visual type used when the
 * preset creates sample content on an empty page.
 */
import type { VisualType } from '@/domain/schemas/visuals';

export type SlotRole = 'title' | 'kpi' | 'chart' | 'table' | 'filter' | 'text';

export interface LayoutSlot {
  role: SlotRole;
  /** Visual created in this slot when the preset fills an empty page. */
  type: VisualType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutPreset {
  id: 'executive-overview' | 'sidebar-navigation' | 'data-dense' | 'storytelling';
  name: string;
  description: string;
  /** Short guidance shown with the preset. */
  bestFor: string;
  slots: LayoutSlot[];
}

/** Rows the slots are designed for (1440 × 900 page, 24 px rows, 12 px gaps). */
export const PRESET_ROWS = 24;
export const PRESET_COLUMNS = 12;

const title = (x: number, y: number, w: number): LayoutSlot => ({ role: 'title', type: 'text', x, y, w, h: 2 });

export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
  {
    id: 'executive-overview',
    name: 'Executive Overview',
    description: 'A row of headline KPIs, key trends, then supporting detail.',
    bestFor: 'Leadership summaries and monthly reviews',
    slots: [
      title(0, 0, 12),
      { role: 'kpi', type: 'kpi', x: 0, y: 2, w: 3, h: 4 },
      { role: 'kpi', type: 'kpi', x: 3, y: 2, w: 3, h: 4 },
      { role: 'kpi', type: 'kpi', x: 6, y: 2, w: 3, h: 4 },
      { role: 'kpi', type: 'kpi', x: 9, y: 2, w: 3, h: 4 },
      { role: 'chart', type: 'line', x: 0, y: 6, w: 8, h: 9 },
      { role: 'chart', type: 'donut', x: 8, y: 6, w: 4, h: 9 },
      { role: 'chart', type: 'bar', x: 0, y: 15, w: 6, h: 9 },
      { role: 'table', type: 'table', x: 6, y: 15, w: 6, h: 9 },
    ],
  },
  {
    id: 'sidebar-navigation',
    name: 'Sidebar Navigation',
    description: 'A filter and navigation rail on the left, content on the right.',
    bestFor: 'Interactive analysis with several filters',
    slots: [
      title(0, 0, 3),
      { role: 'filter', type: 'slicer', x: 0, y: 2, w: 3, h: 3 },
      { role: 'filter', type: 'slicer', x: 0, y: 5, w: 3, h: 3 },
      { role: 'filter', type: 'slicer', x: 0, y: 8, w: 3, h: 3 },
      { role: 'text', type: 'text', x: 0, y: 11, w: 3, h: 13 },
      { role: 'kpi', type: 'kpi', x: 3, y: 0, w: 3, h: 4 },
      { role: 'kpi', type: 'kpi', x: 6, y: 0, w: 3, h: 4 },
      { role: 'kpi', type: 'kpi', x: 9, y: 0, w: 3, h: 4 },
      { role: 'chart', type: 'area', x: 3, y: 4, w: 9, h: 10 },
      { role: 'table', type: 'table', x: 3, y: 14, w: 9, h: 10 },
    ],
  },
  {
    id: 'data-dense',
    name: 'Data Dense',
    description: 'A compact grid that fits many visuals for operational monitoring.',
    bestFor: 'Operations rooms and daily monitoring',
    slots: [
      title(0, 0, 12),
      ...[0, 2, 4, 6, 8, 10].map((x): LayoutSlot => ({ role: 'kpi', type: 'kpi', x, y: 2, w: 2, h: 3 })),
      { role: 'chart', type: 'line', x: 0, y: 5, w: 4, h: 7 },
      { role: 'chart', type: 'bar', x: 4, y: 5, w: 4, h: 7 },
      { role: 'chart', type: 'stackedBar', x: 8, y: 5, w: 4, h: 7 },
      { role: 'chart', type: 'combo', x: 0, y: 12, w: 4, h: 7 },
      { role: 'chart', type: 'pie', x: 4, y: 12, w: 4, h: 7 },
      { role: 'chart', type: 'area', x: 8, y: 12, w: 4, h: 7 },
      { role: 'table', type: 'table', x: 0, y: 19, w: 12, h: 5 },
    ],
  },
  {
    id: 'storytelling',
    name: 'Storytelling',
    description: 'Large charts paired with narrative text that explains the numbers.',
    bestFor: 'Board packs and presentations',
    slots: [
      title(0, 0, 12),
      { role: 'text', type: 'text', x: 0, y: 2, w: 12, h: 2 },
      { role: 'chart', type: 'line', x: 0, y: 4, w: 8, h: 10 },
      { role: 'text', type: 'text', x: 8, y: 4, w: 4, h: 10 },
      { role: 'chart', type: 'bar', x: 0, y: 14, w: 7, h: 10 },
      { role: 'text', type: 'text', x: 7, y: 14, w: 5, h: 10 },
    ],
  },
];

export function getLayoutPreset(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === id);
}

/** Which slot role an existing visual fits best when a layout rearranges a page. */
export function roleOf(type: VisualType): SlotRole {
  switch (type) {
    case 'kpi':
    case 'gauge':
      return 'kpi';
    case 'table':
      return 'table';
    case 'slicer':
      return 'filter';
    case 'text':
    case 'image':
    case 'divider':
      return 'text';
    default:
      return 'chart';
  }
}
