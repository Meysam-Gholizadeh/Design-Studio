import { useState } from 'react';
import { Download, Mail } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { OWNER_CONTACT_EMAIL } from '@/data/siteOwner';
import type { PublishedItem } from '@/domain/schemas/published';
import styles from './FileRequestButton.module.css';

interface FileRequestButtonProps {
  item: PublishedItem;
  /** Visible text; the accessible name always names the file. */
  label: string;
  className?: string;
}

/**
 * The "Download" button of a published file. Files are handed out by the
 * owner on request, so it opens the owner's contact details instead of downloading.
 */
export function FileRequestButton({ item, label, className }: FileRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const subject = encodeURIComponent(`Request for ${item.title} (${item.file.name})`);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Download ${item.file.name}`} title={`Download ${item.file.name}`}>
        <Download size={15} aria-hidden="true" />
        {label}
      </button>
      <ConfirmDialog open={open} title="Request this file" confirmLabel="Close" tone="primary" hideCancel onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)}>
        <p>If you want to have the custom visual (PBIVIZ or PBIX) file, please contact the owner:</p>
        <a className={styles.mail} href={`mailto:${OWNER_CONTACT_EMAIL}?subject=${subject}`}>
          <Mail size={16} aria-hidden="true" />
          {OWNER_CONTACT_EMAIL}
        </a>
      </ConfirmDialog>
    </>
  );
}
