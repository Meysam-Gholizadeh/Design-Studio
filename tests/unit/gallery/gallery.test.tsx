import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { GalleryPage } from '@/pages/GalleryPage';
import { TemplateDetailPage } from '@/pages/TemplateDetailPage';
import { templateRepository } from '@/services/templateService';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/gallery/:templateId" element={<TemplateDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const total = templateRepository.list().length;

describe('GalleryPage', () => {
  it('shows all categories and every template card with a rendered preview', () => {
    renderAt('/gallery');
    expect(screen.getByRole('heading', { name: 'Explore Dashboard Designs' })).toBeInTheDocument();
    const filters = screen.getByRole('group', { name: 'Filter by category' });
    expect(within(filters).getAllByRole('button')).toHaveLength(10); // "All" + 9 categories
    const cards = screen.getAllByTestId('template-card');
    expect(cards).toHaveLength(total);
    // Thumbnails are real dashboards built from visuals, not images.
    expect(cards[0]!.querySelectorAll('[data-visual-type]').length).toBeGreaterThan(5);
    expect(cards[0]!.querySelector('img')).toBeNull();
  });

  it('filters by category (GAL-02) and clears filters (GAL-04)', async () => {
    const user = userEvent.setup();
    renderAt('/gallery');
    await user.click(screen.getByRole('button', { name: /Finance & Controlling/ }));
    expect(screen.getByRole('button', { name: /Finance & Controlling/ })).toHaveAttribute('aria-pressed', 'true');
    const cards = screen.getAllByTestId('template-card');
    expect(cards.every((c) => within(c).getByText('Finance & Controlling'))).toBe(true);
    expect(screen.getByTestId('location')).toHaveTextContent('category=finance');

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(screen.getAllByTestId('template-card')).toHaveLength(total);
  });

  it('searches by keyword (GAL-03) and shows an empty state with recovery', async () => {
    const user = userEvent.setup();
    renderAt('/gallery');
    const search = screen.getByRole('searchbox', { name: 'Search templates' });
    await user.type(search, 'budget');
    expect(screen.getAllByTestId('template-card').map((c) => within(c).getByRole('heading').textContent)).toContain('Financial Performance Overview');

    await user.clear(search);
    await user.type(search, 'zzzz-no-match');
    expect(screen.queryAllByTestId('template-card')).toHaveLength(0);
    expect(screen.getByText('No designs match your filters')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    expect(screen.getAllByTestId('template-card')).toHaveLength(total);
  });

  it('reads the category from the URL', () => {
    renderAt('/gallery?category=procurement');
    const cards = screen.getAllByTestId('template-card');
    expect(cards.length).toBe(templateRepository.search({ categoryId: 'procurement' }).length);
  });

  it('opens the template preview from a card', async () => {
    const user = userEvent.setup();
    renderAt('/gallery');
    await user.click(screen.getByRole('link', { name: 'Preview Sales Performance' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Sales Performance' })).toBeInTheDocument();
  });
});

describe('TemplateDetailPage', () => {
  it('shows the full rendered dashboard and metadata (GAL-05)', () => {
    renderAt('/gallery/finance-performance-overview');
    expect(screen.getByRole('heading', { level: 1, name: 'Financial Performance Overview' })).toBeInTheDocument();
    const details = screen.getByRole('complementary', { name: 'Template details' });
    for (const term of ['Intended audience', 'Purpose', 'Pages', 'Included KPIs', 'Visual types', 'Theme', 'Layout']) {
      expect(within(details).getByText(term)).toBeInTheDocument();
    }
    expect(within(details).getByText('Corporate Blue')).toBeInTheDocument();
    expect(within(details).getByText('Executive Overview')).toBeInTheDocument();
    expect(screen.getAllByText('Sample data — replace with your own data later').length).toBeGreaterThan(0);
  });

  it('navigates between pages of a multi-page template (GAL-06)', async () => {
    const user = userEvent.setup();
    renderAt('/gallery/finance-performance-overview');
    expect(screen.getByText('Financial Performance Overview', { selector: 'h2' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Profitability' }));
    expect(screen.getByRole('tab', { name: 'Profitability' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Profitability Detail', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'P&L Summary table' })).toBeInTheDocument();
  });

  it('supports keyboard navigation between page tabs', async () => {
    const user = userEvent.setup();
    renderAt('/gallery/executive-business-overview');
    screen.getByRole('tab', { name: 'Summary' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Customers & Operations' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Customers & Operations' })).toHaveFocus();
  });

  it('offers a way back to the gallery', async () => {
    const user = userEvent.setup();
    renderAt('/gallery/hr-workforce-overview');
    await user.click(screen.getByRole('link', { name: 'Back to gallery' }));
    expect(screen.getByRole('heading', { name: 'Explore Dashboard Designs' })).toBeInTheDocument();
  });

  it('handles unknown template IDs gracefully', () => {
    renderAt('/gallery/does-not-exist');
    expect(screen.getByText('Template not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to gallery' })).toBeInTheDocument();
  });
});
