import { ICON_NAMES, type IconName } from '@/domain/schemas/icons';

/** "credit-card" → "Credit card". */
export function iconLabel(name: IconName): string {
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Options for an icon picker, with "None" first. */
export const ICON_OPTIONS = [{ value: 'none', label: 'None' }, ...ICON_NAMES.map((n) => ({ value: n, label: iconLabel(n) }))];
