import { useState, type KeyboardEvent } from 'react';
import { LayersPanel } from './LayersPanel';
import { PagesPanel } from './PagesPanel';
import { VisualLibrary } from './VisualLibrary';
import styles from './LeftPanel.module.css';

const TABS = [
  { id: 'visuals', label: 'Visuals' },
  { id: 'pages', label: 'Pages' },
  { id: 'layers', label: 'Layers' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function LeftPanel() {
  const [tab, setTab] = useState<TabId>('visuals');

  const onKey = (e: KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next]!.id);
    document.getElementById(`left-tab-${TABS[next]!.id}`)?.focus();
  };

  return (
    <aside className={styles.panel} aria-label="Library, pages and layers">
      <div role="tablist" aria-label="Left panel" className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`left-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`left-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={styles.tab}
            onClick={() => setTab(t.id)}
            onKeyDown={onKey}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`left-panel-${tab}`} role="tabpanel" aria-labelledby={`left-tab-${tab}`} className={styles.body}>
        {tab === 'visuals' && <VisualLibrary />}
        {tab === 'pages' && <PagesPanel />}
        {tab === 'layers' && <LayersPanel />}
      </div>
    </aside>
  );
}
