import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SlicerComponent } from '@/domain/schemas/visuals';
import { useDashboardRender } from './renderContext';
import styles from './SlicerVisual.module.css';

/**
 * Slicer mock-up. The selection is real local UI state, but it does not filter
 * other visuals (sample control). Inert outside preview mode so it never
 * fights with selection/drag in the editor.
 */
export function SlicerVisual({ component }: { component: SlicerComponent }) {
  // Re-seed local selection whenever options or the default selection change.
  const key = `${component.data.options.join('\u0000')}|${component.config.defaultSelection.join('\u0000')}|${component.config.multiSelect}`;
  return <SlicerControl key={key} component={component} />;
}

function SlicerControl({ component }: { component: SlicerComponent }) {
  const { mode } = useDashboardRender();
  const interactive = mode === 'preview';
  const { field, options } = component.data;
  const cfg = component.config;
  const initial = cfg.defaultSelection.filter((s) => options.includes(s));
  const [selected, setSelected] = useState<string[]>(initial.length ? initial : options.slice(0, 1));
  const label = `${field} filter (sample control)`;

  const toggle = (opt: string) => {
    if (!interactive) return;
    setSelected((cur) => (cfg.multiSelect ? (cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]) : [opt]));
  };

  if (cfg.variant === 'dropdown') {
    return (
      <div className={styles.dropdownWrap}>
        <select
          className={styles.select}
          aria-label={label}
          value={selected[0] ?? ''}
          disabled={!interactive}
          tabIndex={interactive ? 0 : -1}
          onChange={(e) => setSelected([e.target.value])}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </div>
    );
  }

  if (cfg.variant === 'chips') {
    return (
      <div className={styles.chips} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={styles.chip}
            aria-pressed={selected.includes(o)}
            tabIndex={interactive ? 0 : -1}
            onClick={() => toggle(o)}
          >
            {o}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.list} role="group" aria-label={label}>
      {options.map((o) => (
        <label key={o} className={styles.listItem}>
          <input
            type={cfg.multiSelect ? 'checkbox' : 'radio'}
            name={component.id}
            checked={selected.includes(o)}
            disabled={!interactive}
            tabIndex={interactive ? 0 : -1}
            onChange={() => toggle(o)}
          />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}
