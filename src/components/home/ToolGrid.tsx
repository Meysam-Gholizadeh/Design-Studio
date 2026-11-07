import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { Tool } from './tools';
import { useReveal } from './useReveal';
import styles from './ToolGrid.module.css';

/** Bento grid of every studio tool; each card is a working link. Cards rise in as the grid scrolls into view. */
export function ToolGrid({ tools }: { tools: Tool[] }) {
  const { ref, revealed } = useReveal<HTMLUListElement>();
  return (
    <ul ref={ref} className={styles.grid} aria-label="Studio tools" data-revealed={revealed || undefined}>
      {tools.map((t, i) => (
        <li key={t.title} className={styles.item} data-span={t.span ?? 1} data-tone={t.tone} style={{ '--i': i } as CSSProperties}>
          <Link to={t.to} className={styles.card}>
            <span className={styles.icon}>
              <t.icon size={22} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className={styles.body}>
              <span className={styles.title}>{t.title}</span>
              <span className={styles.text}>{t.text}</span>
            </span>
            <span className={styles.action}>
              {t.action} <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
