import { FlaskConical } from 'lucide-react';
import { IMPORTED_DATA_NOTICE, SAMPLE_DATA_NOTICE } from '@/data/sample/sampleData';
import styles from './SampleDataNotice.module.css';

/**
 * Visible label marking dashboard figures as illustrative: fictional sample
 * data, or (for imported designs) placeholder values copied from the user's file.
 */
export function SampleDataNotice({ compact = false, imported = false }: { compact?: boolean; imported?: boolean }) {
  const full = imported ? IMPORTED_DATA_NOTICE : SAMPLE_DATA_NOTICE;
  return (
    <span className={styles.notice} data-compact={compact || undefined} title={compact ? full : undefined}>
      <FlaskConical size={compact ? 12 : 14} aria-hidden="true" />
      {compact ? (imported ? 'Imported values' : 'Sample data') : full}
    </span>
  );
}
