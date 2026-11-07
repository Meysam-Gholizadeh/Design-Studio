import { AlertTriangle, CheckCircle2, Image as ImageIcon, SquareDashed } from 'lucide-react';
import type { ImportItem, ImportStatus } from '@/services/htmlImport/convert/types';
import styles from './ImportReport.module.css';

const STATUS: Record<ImportStatus, { label: string; icon: typeof CheckCircle2 }> = {
  converted: { label: 'Converted', icon: CheckCircle2 },
  approximated: { label: 'Simplified', icon: AlertTriangle },
  picture: { label: 'Picture only', icon: ImageIcon },
  placeholder: { label: 'Placeholder', icon: SquareDashed },
};

function statusCounts(items: ImportItem[]): Record<ImportStatus, number> {
  const counts: Record<ImportStatus, number> = { converted: 0, approximated: 0, picture: 0, placeholder: 0 };
  for (const i of items) counts[i.status]++;
  return counts;
}

/** Summary chips plus one row per imported element, with what it became and any caveats. */
export function ImportReport({ items, notes }: { items: ImportItem[]; notes: string[] }) {
  const counts = statusCounts(items);
  const needsReview = items.filter((i) => i.status !== 'converted');
  const ordered = [...needsReview, ...items.filter((i) => i.status === 'converted')];
  return (
    <section className={styles.report} aria-labelledby="import-report-title">
      <div className={styles.head}>
        <h2 id="import-report-title" className={styles.title}>
          What was found
        </h2>
        <ul className={styles.chips} aria-label="Summary">
          {(Object.keys(STATUS) as ImportStatus[])
            .filter((s) => counts[s] > 0)
            .map((s) => {
              const Icon = STATUS[s].icon;
              return (
                <li key={s} className={styles.chip} data-status={s}>
                  <Icon size={14} aria-hidden="true" />
                  {counts[s]} {STATUS[s].label.toLowerCase()}
                </li>
              );
            })}
        </ul>
      </div>
      {needsReview.length > 0 && (
        <p className={styles.hint}>
          {needsReview.length === 1 ? 'One element needs' : `${needsReview.length} elements need`} a look in the editor before you export to Power BI. They are listed first.
        </p>
      )}
      {notes.map((n) => (
        <p key={n} className={styles.hint}>
          {n}
        </p>
      ))}
      <ul className={styles.items} aria-label="Imported elements">
        {ordered.map((item) => {
          const Icon = STATUS[item.status].icon;
          return (
            <li key={item.id} className={styles.item}>
              <span className={styles.status} data-status={item.status}>
                <Icon size={14} aria-hidden="true" />
                {STATUS[item.status].label}
              </span>
              <span className={styles.main}>
                <span className={styles.itemTitle}>{item.title || item.kind}</span>
                <span className={styles.meta}>
                  {item.kind} · from {item.source}
                </span>
                {item.notes.map((n) => (
                  <span key={n} className={styles.note}>
                    {n}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
