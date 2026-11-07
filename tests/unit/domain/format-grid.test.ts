import { describe, expect, it } from 'vitest';
import { formatAxisValue, formatChange, formatValue } from '@/domain/format';
import { findFreeSlot, heightForRows, maxRowsForHeight, normalizeLayout, rectsOverlap } from '@/domain/grid';
import { DEFAULT_GRID } from '@/domain/defaults';

describe('formatValue', () => {
  it('formats currency with compact notation', () => {
    expect(formatValue(2_450_000, { kind: 'currency', currency: 'USD', compact: true, decimals: 2 })).toBe('$2.45M');
  });
  it('formats percentages stored as percent values', () => {
    expect(formatValue(12.345, { kind: 'percent', decimals: 1 })).toBe('12.3%');
  });
  it('appends a unit suffix', () => {
    expect(formatValue(4.2, { kind: 'number', decimals: 1, suffix: 'days' })).toBe('4.2 days');
  });
  it('renders missing values as an em dash', () => {
    expect(formatValue(undefined)).toBe('—');
    expect(formatValue(Number.NaN)).toBe('—');
  });
  it('keeps explicit decimals for compact values so table columns align', () => {
    expect(formatValue(2_000_000, { kind: 'currency', currency: 'USD', compact: true, decimals: 1 })).toBe('$2.0M');
    expect(formatValue(2_000_000, { kind: 'currency', currency: 'USD', compact: true })).toBe('$2M');
  });
  it('keeps axis labels short', () => {
    expect(formatAxisValue(4_000_000, { kind: 'currency', currency: 'USD', compact: true, decimals: 1 })).toBe('$4M');
    expect(formatAxisValue(2_500_000, { kind: 'currency', currency: 'USD' })).toBe('$2.5M');
    expect(formatAxisValue(0, { kind: 'currency', currency: 'USD', compact: true, decimals: 1 })).toBe('$0');
  });
  it('formats signed changes', () => {
    expect(formatChange(8.4)).toBe('+8.4%');
    expect(formatChange(-2)).toBe('−2.0%');
  });
});

describe('grid geometry', () => {
  it('computes rows that fit a fixed page and back', () => {
    const rows = maxRowsForHeight(900, DEFAULT_GRID);
    expect(rows).toBe(24);
    expect(heightForRows(rows, DEFAULT_GRID)).toBeLessThanOrEqual(900);
    expect(heightForRows(rows + 1, DEFAULT_GRID)).toBeGreaterThan(900);
  });

  it('detects overlap but not edge contact', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 3, h: 3 }, { x: 2, y: 2, w: 3, h: 3 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 3, h: 3 }, { x: 3, y: 0, w: 3, h: 3 })).toBe(false);
  });

  it('finds the first free slot in reading order', () => {
    const occupied = [{ x: 0, y: 0, w: 6, h: 4 }];
    expect(findFreeSlot(occupied, { w: 6, h: 4 }, 12, 24)).toEqual({ x: 6, y: 0 });
    expect(findFreeSlot(occupied, { w: 8, h: 4 }, 12, 24)).toEqual({ x: 0, y: 4 });
  });

  it('finds the nearest free slot to a preferred drop position', () => {
    const occupied = [{ x: 0, y: 0, w: 12, h: 4 }];
    expect(findFreeSlot(occupied, { w: 3, h: 3 }, 12, 24, { x: 5, y: 1 })).toEqual({ x: 5, y: 4 });
  });

  it('returns null when the page is full', () => {
    expect(findFreeSlot([{ x: 0, y: 0, w: 12, h: 24 }], { w: 1, h: 1 }, 12, 24)).toBeNull();
  });

  it('normalizes layouts into bounds and constraints', () => {
    expect(normalizeLayout({ x: 11, y: 30, w: 4, h: 1, minH: 3 }, 12, 24)).toEqual({ x: 8, y: 21, w: 4, h: 3, minH: 3 });
  });
});
