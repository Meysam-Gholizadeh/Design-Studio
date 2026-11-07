import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { LIMITS } from '@/domain/limits';
import type { DashboardComponent } from '@/domain/schemas/visuals';
import { ColorField, FieldRow, Section, SelectField, TextField } from '../fields/Fields';
import { readImageFile } from './imageFile';
import type { SectionProps } from './shared';
import styles from './Inspector.module.css';

type Text = Extract<DashboardComponent, { type: 'text' }>;
type Image = Extract<DashboardComponent, { type: 'image' }>;
type Divider = Extract<DashboardComponent, { type: 'divider' }>;

export function TextSection({ component: c, update }: SectionProps<Text>) {
  const edit = (recipe: (d: Text) => void, key: string) =>
    update((d) => {
      if (d.type === 'text') recipe(d);
    }, key);
  return (
    <Section title="Text style" collapsible defaultOpen>
      <SelectField
        label="Style"
        value={c.config.variant}
        options={[
          { value: 'heading', label: 'Heading' },
          { value: 'subheading', label: 'Subheading' },
          { value: 'body', label: 'Body text' },
          { value: 'caption', label: 'Caption' },
        ]}
        onChange={(v) => edit((d) => void (d.config.variant = v), 'variant')}
      />
      <FieldRow>
        <SelectField
          label="Horizontal"
          value={c.config.align}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(v) => edit((d) => void (d.config.align = v), 'align')}
        />
        <SelectField
          label="Vertical"
          value={c.config.verticalAlign}
          options={[
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' },
          ]}
          onChange={(v) => edit((d) => void (d.config.verticalAlign = v), 'valign')}
        />
      </FieldRow>
      <SelectField
        label="Colour"
        value={c.config.emphasis}
        options={[
          { value: 'default', label: 'Text colour' },
          { value: 'muted', label: 'Muted' },
          { value: 'primary', label: 'Accent' },
        ]}
        onChange={(v) => edit((d) => void (d.config.emphasis = v), 'emphasis')}
      />
    </Section>
  );
}

export function ImageSection({ component: c, update }: SectionProps<Image>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const edit = (recipe: (d: Image) => void, key: string) =>
    update((d) => {
      if (d.type === 'image') recipe(d);
    }, key);

  const onFile = async (file: File) => {
    setError(null);
    const result = await readImageFile(file);
    if ('error' in result) return setError(result.error);
    edit((d) => {
      d.data.src = result.src;
      if (!d.data.alt || d.data.alt === 'Image placeholder') d.data.alt = file.name.replace(/\.[a-z]+$/i, '').slice(0, LIMITS.maxLabelLength);
    }, 'src');
  };

  return (
    <Section title="Image" collapsible defaultOpen>
      <div className={styles.imagePreview}>
        {c.data.src && <img src={c.data.src} alt="" />}
        <Button size="sm" variant="secondary" icon={<ImagePlus size={15} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
          {c.data.src ? 'Replace image' : 'Upload image'}
        </Button>
        {c.data.src && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => edit((d) => void delete d.data.src, 'src')}>
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.fileInput}
          aria-label="Image file"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onFile(file);
          }}
        />
      </div>
      {error && (
        <p className={styles.hint} role="alert" style={{ color: 'var(--app-danger)' }}>
          {error}
        </p>
      )}
      <p className={styles.hint}>PNG, JPEG or WebP. The image is stored inside the design.</p>
      <TextField label="Description (alt text)" value={c.data.alt} maxLength={LIMITS.maxLabelLength} onChange={(v) => edit((d) => void (d.data.alt = v), 'alt')} />
      <SelectField
        label="Fit"
        value={c.config.fit}
        options={[
          { value: 'contain', label: 'Show whole image' },
          { value: 'cover', label: 'Fill the card (crop)' },
        ]}
        onChange={(v) => edit((d) => void (d.config.fit = v), 'fit')}
      />
      {!c.data.src && (
        <TextField label="Placeholder text" value={c.config.placeholderLabel} maxLength={LIMITS.maxLabelLength} onChange={(v) => edit((d) => void (d.config.placeholderLabel = v), 'placeholder')} />
      )}
    </Section>
  );
}

export function DividerSection({ component: c, update }: SectionProps<Divider>) {
  const edit = (recipe: (d: Divider) => void, key: string) =>
    update((d) => {
      if (d.type === 'divider') recipe(d);
    }, key);
  return (
    <Section title="Divider" collapsible defaultOpen>
      <FieldRow>
        <SelectField
          label="Direction"
          value={c.config.orientation}
          options={[
            { value: 'horizontal', label: 'Horizontal' },
            { value: 'vertical', label: 'Vertical' },
          ]}
          onChange={(v) => edit((d) => void (d.config.orientation = v), 'orientation')}
        />
        <SelectField
          label="Line"
          value={c.config.lineStyle}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'none', label: 'None (spacer)' },
          ]}
          onChange={(v) => edit((d) => void (d.config.lineStyle = v), 'line')}
        />
      </FieldRow>
      {c.config.lineStyle !== 'none' && (
        <>
          <SelectField
            label="Thickness"
            value={String(c.config.thickness)}
            options={[1, 2, 3, 4, 6, 8].map((n) => ({ value: String(n), label: `${n} px` }))}
            onChange={(v) => edit((d) => void (d.config.thickness = Number(v)), 'thickness')}
          />
          <ColorField label="Colour" value={c.config.color} fallback="#E0E6EF" onChange={(v) => edit((d) => (v ? (d.config.color = v) : delete d.config.color), 'color')} />
        </>
      )}
    </Section>
  );
}
