import type { CSSProperties } from 'react';
import { MousePointerClick, Rocket, Wand2 } from 'lucide-react';
import { useReveal } from './useReveal';
import styles from './HowItWorks.module.css';

const STEPS = [
  {
    icon: Wand2,
    title: 'Start anywhere',
    text: 'Copy a template, begin from a blank canvas, import an HTML dashboard or ask the AI assistant for a first draft.',
  },
  {
    icon: MousePointerClick,
    title: 'Shape the design',
    text: 'Drag, resize and restyle visuals. Switch themes and layouts freely — your content stays intact.',
  },
  {
    icon: Rocket,
    title: 'Hand it off',
    text: 'Export a Power BI project with sample data, a standalone HTML page or a developer handoff spec.',
  },
];

/** Three-step summary of the workflow; steps rise in when scrolled into view. */
export function HowItWorks() {
  const { ref, revealed } = useReveal<HTMLOListElement>();
  return (
    <ol ref={ref} className={styles.steps} data-revealed={revealed || undefined}>
      {STEPS.map((s, i) => (
        <li key={s.title} className={styles.step} style={{ '--i': i } as CSSProperties}>
          <span className={styles.badge}>
            <s.icon size={20} aria-hidden="true" />
            <span className={styles.number}>{i + 1}</span>
          </span>
          <h3 className={styles.title}>{s.title}</h3>
          <p className={styles.text}>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
