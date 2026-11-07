import { formatValue } from '@/domain/format';
import type { NumberFormat } from '@/domain/schemas/primitives';
import { splitSymbol } from './splitSymbol';

interface ValueTextProps {
  value: number;
  format: NumberFormat;
  superscript?: boolean;
  symbolClassName?: string;
}

/** A formatted number, optionally with its currency symbol small and raised. */
export function ValueText({ value, format, superscript, symbolClassName }: ValueTextProps) {
  const text = formatValue(value, format);
  if (!superscript) return <>{text}</>;
  const { symbol, rest } = splitSymbol(text);
  if (!symbol) return <>{text}</>;
  return (
    <>
      <span className={symbolClassName}>{symbol}</span>
      {rest}
    </>
  );
}
