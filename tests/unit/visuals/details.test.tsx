import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildBarOption, buildLineOption, buildSliceOption } from '@/components/visuals/charts/chartOptions';
import { pillTone } from '@/components/visuals/pillTone';
import { splitSymbol } from '@/components/visuals/splitSymbol';
import { formatAxisValue, formatValue } from '@/domain/format';
import { VisualRenderer } from '@/components/visuals/VisualRenderer';
import { DashboardRenderProvider } from '@/components/visuals/DashboardRenderContext';
import { visual } from '@/data/builders';
import { dashboardComponentSchema, type DashboardComponent } from '@/domain/schemas/visuals';
import { resolveTheme } from '@/services/themeService';

const theme = resolveTheme('midnight-ember');
const renderOpts = { animate: false, interactive: false };

function show(component: DashboardComponent) {
  return render(
    <DashboardRenderProvider theme={theme} mode="preview">
      <VisualRenderer component={component} />
    </DashboardRenderProvider>,
  );
}

describe('detail options are optional and validated', () => {
  it('accepts icons, inline trends, pills, signed values, two-line cells, gradients and glow', () => {
    const kpi = visual('kpi', 'k', [0, 0, 3, 4], { config: { icon: 'wallet', trendStyle: 'inline' }, style: { background: '#3B1A12', backgroundTo: '#141416', glow: true } });
    expect(dashboardComponentSchema.safeParse(kpi).success).toBe(true);
    const table = visual('table', 't', [0, 0, 6, 6], {
      data: {
        columns: [
          { key: 'who', label: 'Who', iconKey: 'icon', secondaryKey: 'sub' },
          { key: 'amount', label: 'Amount', display: 'signed' },
          { key: 'status', label: 'Status', display: 'pill' },
        ],
        rows: [{ who: 'A', icon: 'send', sub: 'Bank transfer', amount: 5, status: 'Active' }],
      },
    });
    expect(dashboardComponentSchema.safeParse(table).success).toBe(true);
  });

  it('rejects unknown icon names and non-colour gradients', () => {
    expect(dashboardComponentSchema.safeParse(visual('kpi', 'k', [0, 0, 3, 4], { config: { icon: 'rocket' as never } })).success).toBe(false);
    expect(dashboardComponentSchema.safeParse(visual('kpi', 'k', [0, 0, 3, 4], { style: { backgroundTo: 'url(x)' } })).success).toBe(false);
  });
});

describe('KPI details', () => {
  it('shows the corner icon and the change beside the value', () => {
    const { container } = show(
      visual('kpi', 'k', [0, 0, 3, 4], {
        data: { value: 1200, format: { kind: 'number' }, comparison: 12.5, comparisonLabel: 'vs last month' },
        config: { label: 'Balance', icon: 'wallet', trendStyle: 'inline', showSparkline: false },
      }),
    );
    expect(container.querySelector('svg.lucide-wallet')).not.toBeNull();
    expect(container.querySelector('[data-trend-style="inline"]')).not.toBeNull();
    expect(screen.getByText(/\+12\.5%/)).toBeInTheDocument();
  });
});

describe('table details', () => {
  const table = visual('table', 't', [0, 0, 8, 6], {
    title: 'Transactions',
    data: {
      columns: [
        { key: 'who', label: 'Who', iconKey: 'icon', secondaryKey: 'sub' },
        { key: 'amount', label: 'Amount', display: 'signed' },
        { key: 'status', label: 'Status', display: 'pill' },
      ],
      rows: [
        { who: 'Brightline Studio', icon: 'arrow-down-left', sub: 'Salary', amount: 4850, status: 'Active' },
        { who: 'Harbour Flats', icon: 'not-an-icon', sub: '', amount: -1420, status: 'Frozen' },
      ],
    },
    config: { showHeader: false },
  });

  it('renders icon badges, second lines, signed coloured amounts and status pills', () => {
    const { container } = show(table);
    expect(container.querySelectorAll('svg.lucide-arrow-down-left')).toHaveLength(1); // unknown icon names are skipped
    expect(screen.getByText('Salary')).toBeInTheDocument();
    const plus = screen.getByText('+4,850');
    expect(plus.closest('td')!.getAttribute('data-tone')).toBe('positive');
    expect(screen.getByText('-1,420').closest('td')!.getAttribute('data-tone')).toBe('negative');
    expect(screen.getByText('Active').getAttribute('data-tone')).toBe('positive');
    expect(screen.getByText('Frozen').getAttribute('data-tone')).toBe('negative');
  });

  it('decides pill tones from the status word', () => {
    expect(pillTone('✓ Done')).toBe('positive');
    expect(pillTone('Overdue')).toBe('negative');
    expect(pillTone('In progress')).toBe('warning');
    expect(pillTone('Debit')).toBe('neutral');
  });
});

describe('card frame details', () => {
  it('draws a gradient background and a glow', () => {
    const { container } = show(visual('text', 'x', [0, 0, 3, 2], { data: { text: 'Hi' }, style: { transparent: false, background: '#3B1A12', backgroundTo: '#141416', glow: true, borderColor: '#F26430' } }));
    const frame = container.querySelector('[data-visual-type="text"]') as HTMLElement;
    expect(frame.style.background).toContain('linear-gradient');
    expect(frame.style.boxShadow).toContain('28px');
  });
});

describe('second detail pass (learning and storefront templates)', () => {
  it('validates the new optional fields and rejects bad values', () => {
    const kpiOk = visual('kpi', 'k', [0, 0, 6, 4], {
      data: { value: 1, format: { kind: 'number' }, sparklineLabels: ['Mon'], details: [{ label: 'Orders', value: 3 }] },
      config: { iconStyle: 'badge', sparklineStyle: 'columns', comparisonKind: 'absolute', symbolStyle: 'superscript' },
      style: { pattern: 'dots', subtitlePlacement: 'above' },
    });
    expect(dashboardComponentSchema.safeParse(kpiOk).success).toBe(true);
    const tooMany = visual('kpi', 'k', [0, 0, 6, 4], { data: { value: 1, format: { kind: 'number' }, details: [1, 2, 3, 4].map((v) => ({ label: 'x', value: v })) } });
    expect(dashboardComponentSchema.safeParse(tooMany).success).toBe(false);
    const remoteArt = visual('kpi', 'k', [0, 0, 6, 4], { data: { value: 1, format: { kind: 'number' }, illustration: 'https://example.com/a.png' } });
    expect(dashboardComponentSchema.safeParse(remoteArt).success).toBe(false);
    expect(dashboardComponentSchema.safeParse(visual('gauge', 'g', [0, 0, 4, 4], { config: { variant: 'ring', ringCenter: 'value' } })).success).toBe(true);
    expect(dashboardComponentSchema.safeParse(visual('gauge', 'g', [0, 0, 4, 4], { config: { variant: 'spiral' as never } })).success).toBe(false);
  });

  it('shows a badge icon, a bar ladder, an absolute change and a raised currency symbol', () => {
    const { container } = show(
      visual('kpi', 'k', [0, 0, 6, 4], {
        data: { value: 394_500, format: { kind: 'currency', currency: 'USD', compact: true, decimals: 1 }, comparison: 57_400, comparisonLabel: 'vs last week', sparkline: [1, 2, 3, 4] },
        config: { label: 'Revenue', icon: 'circle-dollar', iconStyle: 'badge', sparklineStyle: 'bars', comparisonKind: 'absolute', symbolStyle: 'superscript', showSparkline: true },
      }),
    );
    expect(container.querySelector('[data-layout="row"] svg.lucide-circle-dollar-sign')).not.toBeNull();
    expect(screen.getByText('+$57.4K')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument(); // the raised symbol is its own element
    expect(container.querySelectorAll('[class*="ladder"] span')).toHaveLength(4);
  });

  it('highlights the peak column and labels it; shows supporting figures and an overline', () => {
    const { container } = show(
      visual('kpi', 'k', [0, 0, 6, 7], {
        subtitle: 'Last 7 days',
        style: { subtitlePlacement: 'above' },
        data: { value: 51_700, format: { kind: 'number' }, sparkline: [3, 9, 4], sparklineLabels: ['Mon', 'Tue', 'Wed'], details: [{ label: 'Orders', value: 1352 }] },
        config: { label: 'Weekly Visitors', sparklineStyle: 'columns', showSparkline: true },
      }),
    );
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    const peaks = container.querySelectorAll('[data-peak]');
    expect(peaks).toHaveLength(1);
    expect(screen.getByText('Orders').nextElementSibling?.textContent).toBe('1,352');
  });

  it('draws ring gauges with the share or the value in the centre', () => {
    show(visual('gauge', 'g', [0, 0, 6, 6], { data: { value: 36_000, min: 0, max: 50_000, format: { kind: 'number' } }, config: { variant: 'ring', label: 'of 50K' } }));
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('of 50K')).toBeInTheDocument();
  });

  it('draws a hatched progress bar with labels, emphasising the current one', () => {
    const { container } = show(
      visual('gauge', 'g', [0, 0, 8, 6], {
        data: { value: 50, min: 0, max: 100, format: { kind: 'number' } },
        config: { variant: 'progress', label: '', trackStyle: 'striped', scaleLabels: ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      }),
    );
    expect(container.querySelector('[data-track="striped"]')).not.toBeNull();
    expect(screen.getByText('Tue').hasAttribute('data-current')).toBe(true);
    expect(screen.getByText('Sat').hasAttribute('data-current')).toBe(false);
  });

  it('renders initials avatars, accent ranks and star ratings in tables', () => {
    const { container } = show(
      visual('table', 't', [0, 0, 10, 6], {
        data: {
          columns: [
            { key: 'rank', label: 'Rank', display: 'accent' },
            { key: 'who', label: 'Student', avatarKey: 'who' },
            { key: 'rating', label: 'Rating', display: 'rating' },
          ],
          rows: [{ rank: '01', who: 'Amara Okafor', rating: 4.6 }],
        },
        config: { showHeader: false },
      }),
    );
    expect(screen.getByText('AO')).toBeInTheDocument();
    expect(screen.getByText('01').closest('td')!.getAttribute('data-display')).toBe('accent');
    expect(screen.getByText('4.6', { exact: false }).querySelector('svg.lucide-star')).not.toBeNull();
    expect(container.textContent).toContain('out of 5');
  });

  it('dot texture layers over the card background', () => {
    const { container } = show(visual('text', 'x', [0, 0, 3, 2], { data: { text: 'Hi' }, style: { transparent: false, pattern: 'dots', background: '#171717' } }));
    const frame = container.querySelector('[data-visual-type="text"]') as HTMLElement;
    expect(frame.getAttribute('style')).toContain('radial-gradient');
  });

  it('splits leading currency symbols only', () => {
    expect(splitSymbol('$84.3K')).toEqual({ symbol: '$', rest: '84.3K' });
    expect(splitSymbol('-€12')).toEqual({ symbol: '-€', rest: '12' });
    expect(splitSymbol('12,515')).toEqual({ symbol: '', rest: '12,515' });
    expect(splitSymbol('-12')).toEqual({ symbol: '', rest: '-12' });
  });

  it('builds a value legend for donuts', () => {
    const donut = visual('donut', 'd', [0, 0, 8, 8], {
      data: { slices: [{ label: 'Data Science', value: 300 }, { label: 'Other', value: 100 }], format: { kind: 'number' } },
      config: { showLegend: true, legendPosition: 'right', legendValues: true },
    });
    const legend = buildSliceOption(donut as never, theme.tokens, renderOpts).legend as { formatter: (n: string) => string };
    expect(legend.formatter('Data Science')).toBe('{n|Data Science}{v|75% (300)}');
  });

  it('colours delivery and processing statuses', () => {
    expect(pillTone('Delivered')).toBe('positive');
    expect(pillTone('Processing')).toBe('warning');
  });
});

describe('third detail pass (fitness template)', () => {
  it('formats minute durations as hours and minutes, on values and axes', () => {
    expect(formatValue(444, { kind: 'number', duration: 'minutes' })).toBe('7h 24m');
    expect(formatValue(45, { kind: 'number', duration: 'minutes' })).toBe('45m');
    expect(formatAxisValue(480, { kind: 'number', duration: 'minutes' })).toBe('8h');
    // Ignored for other kinds.
    expect(formatValue(444, { kind: 'currency', currency: 'USD', duration: 'minutes' })).toBe('$444');
  });

  it('validates the new optional fields', () => {
    const remote = visual('text', 't', [0, 0, 4, 3], { style: { backdrop: 'https://example.com/x.jpg' } });
    expect(dashboardComponentSchema.safeParse(remote).success).toBe(false);
    const tooMany = visual('text', 't', [0, 0, 4, 3], { data: { text: 'x', highlights: [1, 2, 3, 4, 5].map((n) => ({ label: `L${n}`, value: String(n) })) } });
    expect(dashboardComponentSchema.safeParse(tooMany).success).toBe(false);
    const badRing = visual('gauge', 'g', [0, 0, 4, 4], { data: { value: 1, min: 0, max: 2, format: { kind: 'number' }, rings: [{ label: 'Move', value: 1, max: 0 }] }, config: { variant: 'rings' } });
    expect(dashboardComponentSchema.safeParse(badRing).success).toBe(false);
    const badImage = visual('table', 't', [0, 0, 4, 4], { data: { columns: [{ key: 'a', label: 'A', imageKey: 'p' }], rows: [{ a: 'x', p: 'one' }], images: { one: 'data:image/svg+xml;base64,AAAA' } } });
    expect(dashboardComponentSchema.safeParse(badImage).success).toBe(false);
  });

  it('renders the hero text: overline, accent phrase, lead, title icon and highlight figures', () => {
    const { container } = show(
      visual('text', 'hero', [0, 0, 11, 11], {
        data: {
          overline: 'Good evening, Alex',
          text: 'Better Every You.',
          accentText: 'You.',
          lead: 'Keep pushing.',
          icon: 'activity',
          highlights: [{ label: 'Energy', value: '86', unit: '%', note: 'Good', noteTone: 'accent', icon: 'zap' }],
        },
        config: { variant: 'heading', scale: 'display', overlineStyle: 'accent' },
        style: { transparent: false, backdrop: 'data:image/jpeg;base64,AAAA' },
      }),
    );
    expect(screen.getByText('Good evening, Alex').getAttribute('data-style')).toBe('accent');
    expect(screen.getByText('You.').tagName).toBe('SPAN');
    expect(screen.getByText('Keep pushing.')).toBeInTheDocument();
    expect(screen.getByText('Good').getAttribute('data-tone')).toBe('accent');
    expect(container.querySelector('svg.lucide-zap')).not.toBeNull();
    expect(container.querySelector('img[aria-hidden="true"]')?.getAttribute('src')).toContain('data:image/jpeg');
  });

  it('draws concentric activity rings with a stat column per ring', () => {
    const { container } = show(
      visual('gauge', 'g', [0, 0, 7, 11], {
        data: {
          value: 1,
          min: 0,
          max: 2,
          format: { kind: 'number' },
          rings: [
            { label: 'Move', value: 812, max: 1000, unit: 'kcal', icon: 'flame' },
            { label: 'Stand', value: 10, max: 12, unit: 'hrs' },
          ],
        },
        config: { variant: 'rings', label: '', centerIcon: 'footprints' },
      }),
    );
    expect(container.querySelectorAll('svg circle')).toHaveLength(4); // track + progress per ring
    expect(screen.getByText('812')).toBeInTheDocument();
    expect(screen.getByText('/ 1,000', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Move 812 of 1,000 kcal');
  });

  it('lays the donut legend out as columns with share and detail, and a custom centre caption', () => {
    show(
      visual('donut', 'd', [0, 0, 6, 11], {
        data: { slices: [{ label: 'Carbs', value: 718, detail: '180 g' }, { label: 'Fats', value: 282 }], format: { kind: 'number' } },
        config: { showLegend: true, legendPosition: 'bottom', showTotal: true, legendLayout: 'columns', centerCaption: 'kcal' },
      }),
    );
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('180 g')).toBeInTheDocument();
    expect(screen.getByText('kcal')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('highlights the latest column with a value bubble and adds sparkline markers', () => {
    const { container } = show(
      visual('kpi', 'k', [0, 0, 8, 9], {
        data: { value: 444, format: { kind: 'number', duration: 'minutes' }, sparkline: [450, 420], sparklineLabels: ['Thu', 'Fri'] },
        config: { label: 'Sleep', sparklineStyle: 'columns', columnHighlight: 'last', columnFill: 'accent', showSparkline: true },
      }),
    );
    expect(screen.getByText('7h 0m')).toBeInTheDocument();
    expect(screen.getByText('Fri').hasAttribute('data-current')).toBe(true);
    expect(container.querySelector('[data-fill="accent"]')).not.toBeNull();
    const line = show(
      visual('kpi', 'k2', [0, 0, 8, 9], { data: { value: 1, format: { kind: 'number' }, sparkline: [1, 2, 3] }, config: { label: 'x', showSparkline: true, sparklineMarkers: true } }),
    );
    expect(line.container.querySelectorAll('[data-last]')).toHaveLength(1);
    expect(line.container.querySelectorAll('[class*="dot"]')).toHaveLength(3);
  });

  it('shows table thumbnails from the table image library', () => {
    const { container } = show(
      visual('table', 't', [0, 0, 8, 9], {
        data: {
          columns: [{ key: 'w', label: 'Workout', imageKey: 'p' }],
          rows: [{ w: 'Legs', p: 'legs' }, { w: 'Core', p: 'missing' }],
          images: { legs: 'data:image/jpeg;base64,AAAA' },
        },
        config: { showHeader: false },
      }),
    );
    expect(container.querySelectorAll('img')).toHaveLength(1); // unknown names are skipped
  });
});

describe('chart polish', () => {
  const area = (stacked: boolean, seriesCount: number) =>
    visual('area', 'a', [0, 0, 6, 8], {
      data: {
        categories: ['A', 'B', 'C'],
        series: Array.from({ length: seriesCount }, (_, i) => ({ name: `S${i}`, values: [1, 2, 3] })),
      },
      config: { stacked, showMarkers: true },
    });
  type Series = { areaStyle: { color: unknown; opacity: number }; showSymbol: boolean; stack?: string };

  it('fades a single area to transparent (even when set to stacked) and shows markers', () => {
    const s = (buildLineOption(area(true, 1) as never, theme.tokens, renderOpts).series as Series[])[0]!;
    expect(s.stack).toBeUndefined();
    expect((s.areaStyle.color as { type: string }).type).toBe('linear');
    expect(s.showSymbol).toBe(true);
  });

  it('keeps solid bands for real stacks', () => {
    const series = buildLineOption(area(true, 2) as never, theme.tokens, renderOpts).series as Series[];
    expect(series[0]!.stack).toBe('total');
    expect(series[0]!.areaStyle.opacity).toBeGreaterThan(0.5);
  });

  it('gives bars a gradient fill and rounded ends', () => {
    const bar = visual('bar', 'b', [0, 0, 6, 8], { data: { categories: ['A'], series: [{ name: 'S', values: [1] }] } });
    const s = (buildBarOption(bar as never, theme.tokens, renderOpts).series as { itemStyle: { color: unknown; borderRadius: number[] } }[])[0]!;
    expect((s.itemStyle.color as { type: string }).type).toBe('linear');
    expect(s.itemStyle.borderRadius).toEqual([5, 5, 0, 0]);
  });
});
