import { useState, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { VISUAL_GROUPS, VISUAL_TYPE_LIST } from '@/domain/visualDefinitions';
import type { VisualType } from '@/domain/schemas/visuals';
import { VISUAL_ICONS } from '@/components/visuals/visualIcons';
import { toast } from '@/components/common/toastStore';
import { useEditorStore } from '@/state/editorStore';
import { LIBRARY_DRAG_MIME, libraryDrag } from './libraryDrag';
import styles from './VisualLibrary.module.css';

/** Drag a visual onto the canvas, or click it to add it at the next free position. */
export function VisualLibrary() {
  const addVisual = useEditorStore((s) => s.addVisual);
  const [dragging, setDragging] = useState<VisualType | null>(null);

  const onAdd = (type: VisualType) => {
    const r = addVisual(type);
    if (!r.ok) toast.error(r.reason);
  };

  const onDragStart = (e: DragEvent<HTMLButtonElement>, type: VisualType) => {
    libraryDrag.start(type);
    setDragging(type);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(LIBRARY_DRAG_MIME, type);
    e.dataTransfer.setData('text/plain', type);
  };

  const onDragEnd = () => {
    libraryDrag.end();
    setDragging(null);
  };

  return (
    <div className={styles.library}>
      <p className={styles.hint}>Drag a visual onto the canvas, or click to add it.</p>
      {VISUAL_GROUPS.map((group) => (
        <section key={group.id} className={styles.group} aria-labelledby={`lib-${group.id}`}>
          <h3 id={`lib-${group.id}`} className={styles.groupTitle}>
            {group.label}
          </h3>
          <ul className={styles.items}>
            {VISUAL_TYPE_LIST.filter((d) => d.group === group.id).map((def) => {
              const Icon = VISUAL_ICONS[def.type];
              return (
                <li key={def.type}>
                  <button
                    type="button"
                    className={styles.item}
                    draggable
                    data-dragging={dragging === def.type || undefined}
                    data-visual-library-item={def.type}
                    onDragStart={(e) => onDragStart(e, def.type)}
                    onDragEnd={onDragEnd}
                    onClick={() => onAdd(def.type)}
                    title={def.description}
                    aria-label={`Add ${def.label}`}
                    aria-describedby={`lib-desc-${def.type}`}
                  >
                    <span className={styles.icon}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className={styles.label}>{def.label}</span>
                    <Plus size={14} className={styles.plus} aria-hidden="true" />
                    <span id={`lib-desc-${def.type}`} className="sr-only">
                      {def.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
