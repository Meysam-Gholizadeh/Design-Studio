import type { ComponentStyle } from '@/domain/schemas/visuals';
import { ColorField, FieldRow, NumberField, Section, SelectField, Toggle } from '../fields/Fields';
import { BackdropField } from './BackdropField';
import type { SectionProps } from './shared';

/** Card appearance shared by every visual. Anything unset follows the theme. */
export function StyleSection({ component, update }: SectionProps) {
  const s = component.style;
  const set = (patch: Partial<ComponentStyle>, key: string) =>
    update((d) => {
      const next: Record<string, unknown> = { ...d.style, ...patch };
      for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
      d.style = next as ComponentStyle;
    }, `style-${key}`);
  const transparent = Boolean(s.transparent);

  return (
    <Section title="Card style" collapsible>
      <Toggle label="Transparent card" description="No background, border or shadow" checked={transparent} onChange={(v) => set({ transparent: v || undefined }, 'transparent')} />
      {!transparent && (
        <>
          <ColorField label="Background" value={s.background} fallback="#FFFFFF" onChange={(v) => set({ background: v }, 'background')} />
          <ColorField
            label="Gradient to"
            value={s.backgroundTo}
            fallback={s.background ?? '#FFFFFF'}
            onChange={(v) => set({ backgroundTo: v }, 'background-to')}
          />
          <Toggle label="Border" checked={s.showBorder !== false} onChange={(v) => set({ showBorder: v ? undefined : false }, 'border')} />
          {s.showBorder !== false && <ColorField label="Border colour" value={s.borderColor} fallback="#E0E6EF" onChange={(v) => set({ borderColor: v }, 'border-color')} />}
          <Toggle label="Shadow" checked={s.showShadow !== false} onChange={(v) => set({ showShadow: v ? undefined : false }, 'shadow')} />
          <Toggle
            label="Glow"
            description="Soft halo in the border colour — highlights a selected card"
            checked={Boolean(s.glow)}
            onChange={(v) => set({ glow: v || undefined }, 'glow')}
          />
          <Toggle
            label="Dot texture"
            description="Fine dot grid over the card surface"
            checked={s.pattern === 'dots'}
            onChange={(v) => set({ pattern: v ? 'dots' : undefined }, 'pattern')}
          />
          <BackdropField value={s.backdrop} onChange={(v) => set({ backdrop: v }, 'backdrop')} />
        </>
      )}
      {component.type !== 'divider' && (
        <SelectField
          label="Subtitle position"
          value={s.subtitlePlacement ?? 'below'}
          options={[
            { value: 'below', label: 'Below the title' },
            { value: 'above', label: 'Above the title (small overline)' },
          ]}
          onChange={(v) => set({ subtitlePlacement: v === 'below' ? undefined : v }, 'subtitle-placement')}
        />
      )}
      <FieldRow>
        <NumberField label="Corner radius" value={s.radius} optional integer min={0} max={32} placeholder="Theme" onCommit={(v) => set({ radius: v }, 'radius')} />
        <NumberField label="Padding" value={s.padding} optional integer min={0} max={48} placeholder="Auto" onCommit={(v) => set({ padding: v }, 'padding')} />
      </FieldRow>
      {component.type !== 'kpi' && component.type !== 'divider' && (
        <FieldRow>
          <SelectField
            label="Title alignment"
            value={s.titleAlign ?? 'left'}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
            ]}
            onChange={(v) => set({ titleAlign: v === 'left' ? undefined : v }, 'title-align')}
          />
          <SelectField
            label="Title size"
            value={s.titleSize ?? 'md'}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
            ]}
            onChange={(v) => set({ titleSize: v === 'md' ? undefined : v }, 'title-size')}
          />
        </FieldRow>
      )}
    </Section>
  );
}
