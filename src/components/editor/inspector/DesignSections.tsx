import { useState } from 'react';
import { ChoiceDialog } from '@/components/common/ChoiceDialog';
import { toast } from '@/components/common/toastStore';
import { LayoutWireframe } from '@/components/themes/LayoutWireframe';
import { ThemePicker } from '@/components/themes/ThemePicker';
import { LAYOUT_PRESETS, type LayoutPreset } from '@/data/layoutPresets';
import { themeRepository } from '@/services/themeService';
import { selectActivePage, useEditorStore } from '@/state/editorStore';
import { Section } from '../fields/Fields';
import styles from './DesignSections.module.css';

/** Theme of the whole dashboard: styling only. */
export function ThemeSection() {
  const doc = useEditorStore((s) => s.document)!;
  const setTheme = useEditorStore((s) => s.setTheme);
  const custom = Boolean(doc.themeOverrides && Object.keys(doc.themeOverrides).length);
  return (
    <Section title="Theme" collapsible defaultOpen>
      <p className={styles.note}>Changes colours, fonts and card style on every page. Content and positions stay as they are.</p>
      {custom && <p className={styles.note}>This design uses colours taken from an imported page. Choosing a theme replaces them (you can undo).</p>}
      <ThemePicker
        compact
        name="editor-theme"
        themes={themeRepository.list()}
        value={custom ? null : doc.themeId}
        onChange={(id) => {
          const r = setTheme(id);
          if (!r.ok) toast.error(r.reason);
        }}
      />
    </Section>
  );
}

/** Layout presets for the active page: positions only, never deleting visuals. */
export function LayoutSection() {
  const page = useEditorStore(selectActivePage)!;
  const applyLayoutPreset = useEditorStore((s) => s.applyLayoutPreset);
  const [pending, setPending] = useState<LayoutPreset | null>(null);

  const apply = (preset: LayoutPreset, mode: 'rearrange' | 'new-page') => {
    setPending(null);
    const r = applyLayoutPreset(preset.id, mode);
    if (!r.ok) return toast.error(r.reason);
    if (mode === 'new-page') toast.success(`Added a “${preset.name}” page with sample visuals.`);
    else if (r.overflow) toast.success(`Layout applied. ${r.overflow} visual${r.overflow === 1 ? '' : 's'} didn’t fit and moved to a new page.`);
    else toast.success(`Layout “${preset.name}” applied. Undo with Ctrl+Z.`);
  };

  return (
    <Section title="Layout" collapsible defaultOpen>
      <p className={styles.note}>
        Arranges this page. On an empty page it adds sample visuals; on a page with visuals it moves them into place — nothing is deleted.
      </p>
      <div className={styles.layouts}>
        {LAYOUT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.layout}
            aria-label={`Apply layout ${preset.name}`}
            onClick={() => (page.components.length === 0 ? apply(preset, 'rearrange') : setPending(preset))}
          >
            <LayoutWireframe preset={preset} />
            <span className={styles.layoutName}>{preset.name}</span>
          </button>
        ))}
      </div>
      <ChoiceDialog
        open={pending !== null}
        title={`Apply “${pending?.name ?? ''}”?`}
        choices={[
          { id: 'new-page', label: 'Add as new page' },
          { id: 'rearrange', label: 'Rearrange this page', variant: 'primary' },
        ]}
        onChoose={(id) => pending && apply(pending, id as 'rearrange' | 'new-page')}
        onCancel={() => setPending(null)}
      >
        This page already has {page.components.length} visual{page.components.length === 1 ? '' : 's'}. <strong>Rearrange this page</strong> moves them into the layout (none are
        deleted; any that don’t fit go to a new page). <strong>Add as new page</strong> leaves this page as it is and adds the layout with sample visuals.
      </ChoiceDialog>
    </Section>
  );
}
