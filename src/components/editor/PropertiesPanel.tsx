import { useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Copy, MousePointer2, RotateCcw, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/common/toastStore';
import { VISUAL_ICONS } from '@/components/visuals/visualIcons';
import { PAGE_SIZES } from '@/domain/defaults';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { resolveTheme } from '@/services/themeService';
import { pageMaxRows } from '@/state/documentOps';
import { selectActivePage, selectSelectedComponent, useEditorStore } from '@/state/editorStore';
import { CommitTextField, NumberGroup, Section, SelectField, TextField, Toggle } from './fields/Fields';
import { BackdropField } from './inspector/BackdropField';
import { ChartDisplaySection, SeriesDataSection, SliceDataSection } from './inspector/ChartSections';
import { DividerSection, ImageSection, TextSection } from './inspector/ContentSections';
import { SlicerSection, TableSection } from './inspector/DataSections';
import { LayoutSection, ThemeSection } from './inspector/DesignSections';
import { GaugeSection, KpiSection } from './inspector/MetricSections';
import { KpiDetailSection } from './inspector/KpiDetailSection';
import { TextExtrasSection } from './inspector/TextExtrasSection';
import type { Update } from './inspector/shared';
import { StyleSection } from './inspector/StyleSection';
import styles from './PropertiesPanel.module.css';

/** Visual types whose card shows a title/subtitle header. */
const HAS_HEADER = new Set<DashboardComponent['type']>(['bar', 'line', 'area', 'pie', 'donut', 'stackedBar', 'combo', 'table', 'gauge', 'slicer', 'image', 'text']);

/** Type-specific sections. */
function TypeSections({ component: c, update, palette }: { component: DashboardComponent; update: Update; palette: string[] }) {
  switch (c.type) {
    case 'bar':
    case 'stackedBar':
    case 'line':
    case 'area':
    case 'combo':
      return (
        <>
          <ChartDisplaySection component={c} update={update} />
          <SeriesDataSection component={c} update={update} palette={palette} />
        </>
      );
    case 'pie':
    case 'donut':
      return (
        <>
          <ChartDisplaySection component={c} update={update} />
          <SliceDataSection component={c} update={update} palette={palette} />
        </>
      );
    case 'kpi':
      return (
        <>
          <KpiSection component={c} update={update} />
          <KpiDetailSection component={c} update={update} />
        </>
      );
    case 'gauge':
      return <GaugeSection component={c} update={update} />;
    case 'table':
      return <TableSection component={c} update={update} />;
    case 'slicer':
      return <SlicerSection component={c} update={update} />;
    case 'text':
      return (
        <>
          <TextSection component={c} update={update} />
          <TextExtrasSection component={c} update={update} />
        </>
      );
    case 'image':
      return <ImageSection component={c} update={update} />;
    case 'divider':
      return <DividerSection component={c} update={update} />;
  }
}

function VisualProperties({ component }: { component: DashboardComponent }) {
  const { updateComponent, setComponentLayout, duplicateSelected, deleteComponent, reorder } = useEditorStore.getState();
  const page = useEditorStore(selectActivePage)!;
  const doc = useEditorStore((s) => s.document)!;
  const [confirmReset, setConfirmReset] = useState(false);
  const def = getVisualDefinition(component.type);
  const Icon = VISUAL_ICONS[component.type];
  const id = component.id;
  const update: Update = (recipe, key) => updateComponent(id, recipe, key);
  const palette = resolveTheme(doc.themeId, doc.themeOverrides).tokens.chartPalette;

  const resetToDefault = () => {
    setConfirmReset(false);
    const defaults = def.createDefaults() as Record<string, unknown>;
    updateComponent(id, (d) => {
      const draft = d as unknown as Record<string, unknown>;
      // Keep identity, type and position; everything else returns to the visual's defaults.
      for (const key of Object.keys(draft)) if (!['id', 'type', 'layout'].includes(key) && !(key in defaults)) delete draft[key];
      Object.assign(draft, structuredClone(defaults));
    });
    toast.success('Visual reset to its default content. Undo with Ctrl+Z.');
  };

  return (
    <>
      <div className={styles.head}>
        <span className={styles.headIcon}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className={styles.headTitle}>{def.label}</h2>
          <p className={styles.headText}>{def.description}</p>
        </div>
      </div>

      <Section title="Content">
        {component.type === 'text' && (
          <TextField
            label="Text"
            multiline
            maxLength={4000}
            value={component.data.text}
            onChange={(v) =>
              update((d) => {
                if (d.type === 'text') d.data.text = v;
              }, 'text')
            }
          />
        )}
        {component.type === 'kpi' && (
          <TextField
            label="Label"
            value={component.config.label}
            onChange={(v) =>
              update((d) => {
                if (d.type !== 'kpi') return;
                d.config.label = v;
                d.title = v;
              }, 'label')
            }
          />
        )}
        {HAS_HEADER.has(component.type) && (
          <>
            <TextField label="Title" value={component.title ?? ''} placeholder={component.type === 'text' ? 'Optional card title' : 'Add a title'} onChange={(v) => update((d) => void (d.title = v || undefined), 'title')} />
            <TextField label="Subtitle" value={component.subtitle ?? ''} placeholder="Optional" onChange={(v) => update((d) => void (d.subtitle = v || undefined), 'subtitle')} />
          </>
        )}
        {component.type === 'divider' && <p className={styles.note}>Dividers have no text. Use them to separate sections.</p>}
      </Section>

      <TypeSections component={component} update={update} palette={palette} />

      <StyleSection component={component} update={update} />

      <Section title="Position & size">
        <NumberGroup
          legend="Grid position"
          fields={[
            { key: 'x', label: 'X', value: component.layout.x },
            { key: 'y', label: 'Y', value: component.layout.y },
            { key: 'w', label: 'W', value: component.layout.w, min: 1 },
            { key: 'h', label: 'H', value: component.layout.h, min: 1 },
          ]}
          hint={`In grid cells · ${page.grid.columns} columns × ${pageMaxRows(doc, page)} rows. Tip: arrow keys move, Shift + arrows resize.`}
          onCommit={(v) => {
            const r = setComponentLayout(id, { x: v.x!, y: v.y!, w: v.w!, h: v.h! });
            return r.ok ? null : r.reason;
          }}
        />
      </Section>

      <Section title="Behavior">
        <Toggle label="Hidden" description="Hidden visuals don’t appear in previews" checked={Boolean(component.hidden)} onChange={(v) => update((d) => void (d.hidden = v || undefined), 'hidden')} />
        <Toggle label="Locked" description="Prevent moving and resizing" checked={Boolean(component.locked)} onChange={(v) => update((d) => void (d.locked = v || undefined), 'locked')} />
      </Section>

      <Section title="Arrange">
        <div className={styles.arrange}>
          <IconButton label="Bring to front" icon={<ArrowUpToLine size={16} />} variant="secondary" size="sm" onClick={() => reorder(id, 'front')} />
          <IconButton label="Bring forward" icon={<ChevronUp size={16} />} variant="secondary" size="sm" onClick={() => reorder(id, 'forward')} />
          <IconButton label="Send backward" icon={<ChevronDown size={16} />} variant="secondary" size="sm" onClick={() => reorder(id, 'backward')} />
          <IconButton label="Send to back" icon={<ArrowDownToLine size={16} />} variant="secondary" size="sm" onClick={() => reorder(id, 'back')} />
        </div>
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Copy size={15} aria-hidden="true" />}
            onClick={() => {
              const r = duplicateSelected();
              if (!r.ok) toast.error(r.reason);
            }}
          >
            Duplicate
          </Button>
          <Button variant="secondary" size="sm" icon={<Trash2 size={15} aria-hidden="true" />} className={styles.delete} onClick={() => deleteComponent(id)}>
            Delete
          </Button>
        </div>
        <Button variant="ghost" size="sm" icon={<RotateCcw size={15} aria-hidden="true" />} onClick={() => setConfirmReset(true)}>
          Reset to default
        </Button>
      </Section>

      <ConfirmDialog open={confirmReset} title="Reset this visual?" confirmLabel="Reset" tone="primary" onConfirm={resetToDefault} onCancel={() => setConfirmReset(false)}>
        Its content, settings and style go back to the defaults for a {def.label.toLowerCase()}. Position and size stay. You can undo this.
      </ConfirmDialog>
    </>
  );
}

function PageProperties() {
  const page = useEditorStore(selectActivePage)!;
  const doc = useEditorStore((s) => s.document)!;
  const { renamePage, setCanvasSize, setCanvasBackgroundImage } = useEditorStore.getState();
  const sizeId = PAGE_SIZES.find((s) => s.width === doc.canvas.width && s.height === doc.canvas.height)?.id ?? 'custom';
  const sizeOptions = [
    ...PAGE_SIZES.map((s) => ({ value: s.id as string, label: `${s.label} · ${s.width}×${s.height}` })),
    ...(sizeId === 'custom' ? [{ value: 'custom', label: `Custom · ${doc.canvas.width}×${doc.canvas.height}` }] : []),
  ];

  return (
    <>
      <div className={styles.emptyHint}>
        <MousePointer2 size={18} aria-hidden="true" />
        <p>Select a visual on the canvas to edit it.</p>
      </div>
      <Section title="Page">
        <CommitTextField
          label="Page name"
          value={page.name}
          onCommit={(v) => {
            const r = renamePage(page.id, v);
            return r.ok ? null : r.reason;
          }}
        />
        <SelectField
          label="Page size (all pages)"
          value={sizeId}
          options={sizeOptions}
          hint={`${page.grid.columns} columns × ${pageMaxRows(doc, page)} rows · ${page.components.length} visual${page.components.length === 1 ? '' : 's'} · ${doc.pages.length} page${doc.pages.length === 1 ? '' : 's'}`}
          onChange={(id) => {
            const size = PAGE_SIZES.find((s) => s.id === id);
            if (!size) return;
            const r = setCanvasSize({ width: size.width, height: size.height });
            if (!r.ok) toast.error(r.reason);
          }}
        />
        <BackdropField
          noun="page background picture"
          hint="Stretched over every page behind the visuals, e.g. a coloured hero band drawn for this layout. Exported as the Power BI page background."
          value={doc.canvas.backgroundImage}
          onChange={(src) => {
            const r = setCanvasBackgroundImage(src);
            if (!r.ok) toast.error(r.reason);
          }}
        />
      </Section>
      <ThemeSection />
      <LayoutSection />
    </>
  );
}

export function PropertiesPanel() {
  const selected = useEditorStore(selectSelectedComponent);
  return (
    <div className={styles.panel} aria-label="Properties">
      {/* Keyed so field drafts reset when the selection changes. */}
      {selected ? <VisualProperties key={selected.id} component={selected} /> : <PageProperties />}
    </div>
  );
}
