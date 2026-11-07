import { useEffect, useRef } from 'react';
import type { EChartsOption } from 'echarts';
import { echarts } from './echartsCore';
import styles from './EChart.module.css';

interface EChartProps {
  option: EChartsOption;
  /** Accessible description of the chart for screen readers. */
  ariaLabel: string;
}

/**
 * Minimal React wrapper around an ECharts instance: init once, apply options on
 * change (not merged, so removed series disappear), resize with the container,
 * dispose on unmount.
 */
export function EChart({ option, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el, undefined, { renderer: 'svg' });
    chartRef.current = chart;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!chart.isDisposed()) chart.resize();
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return <div ref={containerRef} className={styles.chart} role="img" aria-label={ariaLabel} />;
}
