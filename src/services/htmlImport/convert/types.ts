import type { DashboardComponent } from '@/domain/schemas/visuals';
import type { RawRect } from '../rawExtraction';

export type ImportStatus =
  /** Converted with its data. */
  | 'converted'
  /** Converted, but something was simplified (see notes). */
  | 'approximated'
  /** Could not be converted; kept as a picture of the original. */
  | 'picture'
  /** Could not be converted or pictured; an empty placeholder keeps its place. */
  | 'placeholder';

export interface ImportItem {
  /** Component id in the converted design. */
  id: string;
  /** What it became, e.g. "Line chart". */
  kind: string;
  /** Where it came from, e.g. "Chart.js", "HTML table". */
  source: string;
  title: string;
  status: ImportStatus;
  notes: string[];
}

/** A converted piece before layout: the component plus its rectangle in the original page. */
export interface Piece {
  rect: RawRect;
  component: DashboardComponent;
  item: ImportItem;
}

export const LIBRARY_NAMES: Record<string, string> = {
  chartjs: 'Chart.js',
  echarts: 'ECharts',
  plotly: 'Plotly',
  highcharts: 'Highcharts',
  apexcharts: 'ApexCharts',
  canvas: 'Canvas drawing',
  svg: 'SVG drawing',
  css: 'HTML/CSS drawing',
};
