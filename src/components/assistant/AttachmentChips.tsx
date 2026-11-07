import { FileSpreadsheet, FileText, X } from 'lucide-react';
import { formatBytes, type Attachment } from '@/services/assistant/attachments';
import styles from './Assistant.module.css';

interface AttachmentChipsProps {
  attachments: Attachment[];
  /** When given, each chip has a remove button. */
  onRemove?: (index: number) => void;
  label: string;
}

const describe = (a: Attachment) => (a.kind === 'image' ? 'Image' : a.kind === 'pdf' ? 'PDF' : a.format);

/** Attached files as chips: image thumbnails, or an icon with the file type and size. */
export function AttachmentChips({ attachments, onRemove, label }: AttachmentChipsProps) {
  if (attachments.length === 0) return null;
  return (
    <ul className={styles.chips} aria-label={label}>
      {attachments.map((a, i) => (
        <li key={`${a.name}-${i}`} className={styles.chip}>
          {a.kind === 'image' ? (
            <img className={styles.chipThumb} src={`data:${a.mediaType};base64,${a.data}`} alt="" />
          ) : (
            <span className={styles.chipIcon} aria-hidden="true">
              {a.kind === 'text' && /excel|csv|tsv/i.test(a.format) ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
            </span>
          )}
          <span className={styles.chipText}>
            <span className={styles.chipName} title={a.name}>
              {a.name}
            </span>
            <span className={styles.chipMeta}>
              {describe(a)} · {formatBytes(a.size)}
              {a.kind === 'text' && a.truncated ? ' · beginning only' : ''}
            </span>
          </span>
          {onRemove && (
            <button type="button" className={styles.chipRemove} aria-label={`Remove ${a.name}`} title="Remove" onClick={() => onRemove(i)}>
              <X size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
