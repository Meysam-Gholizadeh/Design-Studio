/**
 * Tree-shaken ECharts registration. Only the chart types and components we use
 * are bundled. The SVG renderer keeps charts crisp when dashboards are scaled
 * (gallery thumbnails, zoom-to-fit) and keeps memory low with many instances.
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer]);

export { echarts };
