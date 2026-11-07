import { describe, expect, it } from 'vitest';
import { parseNumber } from '@/components/editor/inspector/parseNumber';

describe('parseNumber (data cells in the properties panel)', () => {
  it.each([
    ['1234', 1234],
    ['1,234,567.5', 1234567.5],
    ['1234,5', 1234.5],
    ['-7', -7],
    [' 42 ', 42],
    ['0.125', 0.125],
  ])('%s → %d', (text, value) => expect(parseNumber(text)).toBe(value));

  it.each(['', 'abc', '12abc', '1,2,3'])('rejects %j', (text) => expect(parseNumber(text)).toBeNull());
});
