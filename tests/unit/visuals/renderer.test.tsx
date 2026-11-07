import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPageView } from '@/components/dashboard/DashboardPageView';
import { trendTone } from '@/components/visuals/kpiTrend';
import { SHOWCASE_DOCUMENT } from '@/data/sample/showcaseDocument';
import { VISUAL_TYPES } from '@/domain/schemas/visuals';
import { showcaseCopy } from '../fixtures';

function pageRoot(container: HTMLElement) {
  return container.querySelector('[role="group"]') as HTMLElement;
}

describe('DashboardPageView', () => {
  it('renders every visual on each page of the showcase document', () => {
    const rendered = new Set<string>();
    SHOWCASE_DOCUMENT.pages.forEach((p, i) => {
      const { container, unmount } = render(<DashboardPageView document={SHOWCASE_DOCUMENT} pageIndex={i} mode="preview" />);
      const visuals = container.querySelectorAll('[data-visual-type]');
      expect(visuals).toHaveLength(p.components.length);
      visuals.forEach((v) => rendered.add(v.getAttribute('data-visual-type')!));
      expect(container.querySelector('[role="alert"]')).toBeNull();
      unmount();
    });
    // The showcase exercises every visual type in the library.
    expect([...rendered].sort()).toEqual([...VISUAL_TYPES].sort());
  });

  it('positions visuals from grid units using the page geometry', () => {
    const { container } = render(<DashboardPageView document={SHOWCASE_DOCUMENT} mode="preview" />);
    const first = container.querySelector('[data-visual-type]')!.parentElement as HTMLElement;
    // Logo at x=0,y=0 → container padding offset.
    expect(first.style.left).toBe('16px');
    expect(first.style.top).toBe('16px');
  });

  it('applies theme tokens to the dashboard root and switches theme without changing content', () => {
    const { container, rerender } = render(<DashboardPageView document={SHOWCASE_DOCUMENT} mode="preview" />);
    expect(pageRoot(container).style.getPropertyValue('--ds-surface')).toBe('#FFFFFF');
    const textBefore = pageRoot(container).textContent;

    rerender(<DashboardPageView document={SHOWCASE_DOCUMENT} mode="preview" themeId="modern-dark" />);
    expect(pageRoot(container).style.getPropertyValue('--ds-surface')).toBe('#172133');
    expect(pageRoot(container).getAttribute('data-theme-mode')).toBe('dark');
    expect(pageRoot(container).textContent).toBe(textBefore);
  });

  it('renders user text as text, never as HTML', () => {
    const doc = showcaseCopy();
    const heading = doc.pages[0]!.components.find((c) => c.type === 'text')!;
    if (heading.type === 'text') heading.data.text = '<script>window.__pwned = true</script><b>bold</b>';
    const { container } = render(<DashboardPageView document={doc} mode="preview" />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText(/<script>window.__pwned/)).toBeInTheDocument();
  });

  it('skips hidden visuals', () => {
    const doc = showcaseCopy();
    doc.pages[0]!.components[0]!.hidden = true;
    const { container } = render(<DashboardPageView document={doc} mode="preview" />);
    expect(container.querySelectorAll('[data-visual-type]')).toHaveLength(doc.pages[0]!.components.length - 1);
  });

  it('isolates a broken visual behind an error boundary', () => {
    const doc = showcaseCopy();
    const table = doc.pages[0]!.components.find((c) => c.type === 'table')!;
    // Simulate corrupted in-memory data that bypassed validation.
    (table as { data: unknown }).data = { columns: null, rows: null };
    const { container } = render(<DashboardPageView document={doc} mode="preview" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t be displayed');
    expect(container.querySelectorAll('[data-visual-type]')).toHaveLength(doc.pages[0]!.components.length);
  });

  it('formats KPI values and labels trends by polarity', () => {
    render(<DashboardPageView document={SHOWCASE_DOCUMENT} mode="preview" />);
    expect(screen.getByText('Return Rate', { selector: 'div' })).toBeInTheDocument();
    expect(trendTone(-0.6, 'lowerIsBetter')).toBe('positive');
    expect(trendTone(3, 'lowerIsBetter')).toBe('negative');
    expect(trendTone(3, 'higherIsBetter')).toBe('positive');
  });
});
