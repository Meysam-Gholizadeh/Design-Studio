import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// jsdom lacks ResizeObserver; a no-op is enough for render tests.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

// jsdom performs no layout; give elements a plausible size so scaled previews render.
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 });

// ECharts needs real layout; render tests verify our wrapper receives options instead.
vi.mock('@/components/visuals/charts/EChart', async () => {
  const { createElement } = await import('react');
  return {
    EChart: ({ ariaLabel }: { ariaLabel: string }) => createElement('div', { role: 'img', 'aria-label': ariaLabel, 'data-testid': 'echart' }),
  };
});
