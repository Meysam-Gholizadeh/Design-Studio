import type { Category } from '@/domain/schemas/catalog';
import { CategoryIcon } from './CategoryIcon';
import styles from './CategoryFilter.module.css';

interface CategoryFilterProps {
  categories: readonly Category[];
  counts: Record<string, number>;
  total: number;
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

export function CategoryFilter({ categories, counts, total, value, onChange }: CategoryFilterProps) {
  return (
    <div className={styles.chips} role="group" aria-label="Filter by category">
      <button type="button" className={styles.chip} aria-pressed={value === null} onClick={() => onChange(null)}>
        <CategoryIcon size={14} />
        All categories
        <span className={styles.count}>{total}</span>
      </button>
      {categories.map((c) => (
        <button key={c.id} type="button" className={styles.chip} aria-pressed={value === c.id} onClick={() => onChange(c.id)} title={c.description}>
          <CategoryIcon icon={c.icon} size={14} />
          {c.name}
          <span className={styles.count}>{counts[c.id] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
