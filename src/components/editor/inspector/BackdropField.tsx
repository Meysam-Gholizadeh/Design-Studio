import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { readImageFile } from './imageFile';
import styles from './Inspector.module.css';

interface BackdropFieldProps {
  value: string | undefined;
  onChange: (src: string | undefined) => void;
  /** What the picture is, for the buttons and file input ("backdrop photo"). */
  noun?: string;
  hint?: string;
}

/** Upload / replace / remove a decorative picture (by default the card's backdrop photo). */
export function BackdropField({
  value,
  onChange,
  noun = 'backdrop photo',
  hint = 'Decorative photo on the right of the card, fading into it behind the content.',
}: BackdropFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className={styles.imagePreview}>
        {value && <img src={value} alt="" />}
        <Button size="sm" variant="secondary" icon={<ImagePlus size={15} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
          {value ? `Replace ${noun}` : `Add ${noun}`}
        </Button>
        {value && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => onChange(undefined)}>
            Remove
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.fileInput}
          aria-label={`${noun.charAt(0).toUpperCase()}${noun.slice(1)} file`}
          tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setError(null);
            const result = await readImageFile(file);
            if ('error' in result) setError(result.error);
            else onChange(result.src);
          }}
        />
      </div>
      {error && (
        <p className={styles.hint} role="alert" style={{ color: 'var(--app-danger)' }}>
          {error}
        </p>
      )}
      <p className={styles.hint}>{hint}</p>
    </>
  );
}
