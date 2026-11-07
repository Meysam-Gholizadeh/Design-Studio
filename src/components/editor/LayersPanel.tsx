import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { IconButton } from '@/components/common/Button';
import { VISUAL_ICONS } from '@/components/visuals/visualIcons';
import { selectActivePage, useEditorStore } from '@/state/editorStore';
import { componentDisplayName } from './componentName';
import styles from './LayersPanel.module.css';

/** Visuals on the active page, top-most first. */
export function LayersPanel() {
  const page = useEditorStore(selectActivePage);
  const selectedId = useEditorStore((s) => s.selectedId);
  const { select, updateComponent } = useEditorStore.getState();

  if (!page || page.components.length === 0) {
    return <p className={styles.empty}>No visuals on this page yet.</p>;
  }

  const layers = [...page.components].reverse();
  return (
    <ul className={styles.list} aria-label="Layers, top first">
      {layers.map((c) => {
        const Icon = VISUAL_ICONS[c.type];
        const name = componentDisplayName(c);
        return (
          <li key={c.id} className={styles.row} data-selected={c.id === selectedId || undefined} data-hidden={c.hidden || undefined}>
            <button type="button" className={styles.select} onClick={() => select(c.id)} aria-pressed={c.id === selectedId}>
              <Icon size={15} aria-hidden="true" />
              <span className={styles.name}>{name}</span>
            </button>
            <IconButton
              size="sm"
              label={c.hidden ? `Show ${name}` : `Hide ${name}`}
              icon={c.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
              onClick={() =>
                updateComponent(c.id, (d) => {
                  d.hidden = !d.hidden || undefined;
                })
              }
            />
            <IconButton
              size="sm"
              label={c.locked ? `Unlock ${name}` : `Lock ${name}`}
              icon={c.locked ? <Lock size={14} /> : <Unlock size={14} />}
              active={c.locked}
              onClick={() =>
                updateComponent(c.id, (d) => {
                  d.locked = !d.locked || undefined;
                })
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
