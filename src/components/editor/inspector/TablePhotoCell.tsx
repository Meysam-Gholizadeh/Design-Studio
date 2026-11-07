import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { readImageFile } from './imageFile';
import styles from './Inspector.module.css';

interface TablePhotoCellProps {
  label: string;
  src: string | undefined;
  onUpload: (src: string) => void;
  onRemove: () => void;
}

/** Rows grid cell for a thumbnail photo: preview, upload/replace and remove. */
export function TablePhotoCell({ label, src, onUpload, onRemove }: TablePhotoCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className={styles.photoCell}>
      {src && <img src={src} alt="" />}
      <button type="button" className={styles.iconBtn} aria-label={`${src ? 'Replace' : 'Upload'} ${label}`} title={src ? 'Replace photo' : 'Upload photo'} onClick={() => inputRef.current?.click()}>
        <ImagePlus size={14} />
      </button>
      {src && (
        <button type="button" className={styles.iconBtn} aria-label={`Remove ${label}`} title="Remove photo" onClick={onRemove}>
          <X size={14} />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={styles.fileInput}
        aria-label={`${label} file`}
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setError(null);
          const result = await readImageFile(file);
          if ('error' in result) setError(result.error);
          else onUpload(result.src);
        }}
      />
      {error && (
        <span role="alert" className={styles.hint} style={{ color: 'var(--app-danger)' }}>
          {error}
        </span>
      )}
    </span>
  );
}
