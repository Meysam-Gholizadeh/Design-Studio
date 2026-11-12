import { useState } from 'react';
import { BarChart3, ExternalLink, ListChecks, Puzzle, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { PublishedItem, PublishedManifest } from '@/domain/schemas/published';
import { createGithubPublisher, type GithubTarget } from '@/services/published/githubPublisher';
import { formatBytes } from '@/services/published/manifest';
import styles from './Admin.module.css';

interface PublishedListProps {
  target: GithubTarget;
  /** The list on the branch; null while loading. */
  manifest: PublishedManifest | null;
  loadError: string | null;
  onChanged: (manifest: PublishedManifest, message: string) => void;
  onReload: () => void;
}

/** What is published on the branch, with removal (one commit that deletes the files and the list entry). */
export function PublishedList({ target, manifest, loadError, onChanged, onReload }: PublishedListProps) {
  const [pending, setPending] = useState<PublishedItem | null>(null);
  /** Id of the item being changed (one change at a time: each is a commit). */
  const [working, setWorking] = useState<string | null>(null);
  /** The switch shows the requested state while its commit is saved (reverts if it fails). */
  const [pendingDownload, setPendingDownload] = useState<{ id: string; on: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (item: PublishedItem, action: () => Promise<PublishedManifest>, done: string, failed: string) => {
    setWorking(item.id);
    setError(null);
    try {
      onChanged(await action(), done);
    } catch (err) {
      setError(err instanceof Error ? err.message : failed);
    } finally {
      setWorking(null);
    }
  };

  const remove = async () => {
    if (!pending) return;
    const item = pending;
    setPending(null);
    await run(item, () => createGithubPublisher(target).remove(item), `“${item.title}” was removed. The gallery updates after the next deploy.`, 'The item could not be removed.');
  };

  const toggleDownload = async (item: PublishedItem, on: boolean) => {
    setPendingDownload({ id: item.id, on });
    await run(
      item,
      () => createGithubPublisher(target).setDownloadable(item, on),
      `Downloads of “${item.title}” are ${on ? 'on' : 'off'}. The gallery updates after the next deploy.`,
      'The download setting could not be changed.',
    );
    setPendingDownload(null);
  };

  return (
    <section className={styles.panel} aria-labelledby="published-list-title">
      <h2 id="published-list-title" className={styles.panelTitle}>
        <ListChecks size={18} aria-hidden="true" /> Published files
      </h2>
      <p className={styles.text}>
        As on the {target.branch} branch. Files published in the last few minutes may not be on the live site yet.{' '}
        <a href={`https://github.com/${target.owner}/${target.repo}/tree/${target.branch}/public/published`} target="_blank" rel="noreferrer">
          View on GitHub <ExternalLink size={12} aria-hidden="true" />
        </a>
      </p>
      {loadError && (
        <div className={styles.error} role="alert">
          {loadError}{' '}
          <Button size="sm" variant="ghost" onClick={onReload}>
            Try again
          </Button>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!manifest && !loadError && <p className={styles.status}>Loading…</p>}
      {manifest && manifest.items.length === 0 && <p className={styles.status}>Nothing is published yet.</p>}
      {manifest && manifest.items.length > 0 && (
        <ul className={styles.list}>
          {manifest.items.map((item) => {
            return (
              <li key={item.id} className={styles.item} data-testid="published-row">
                <Thumb item={item} />
                <div className={styles.itemText}>
                  <div className={styles.itemTitle}>{item.title}</div>
                  <div className={styles.itemMeta}>
                    {item.file.name} · {formatBytes(item.file.size)} · {new Date(item.publishedAt).toLocaleDateString()}
                  </div>
                </div>
                {item.kind === 'pbiviz' && (
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={pendingDownload?.id === item.id ? pendingDownload.on : item.downloadable}
                      onChange={(e) => void toggleDownload(item, e.target.checked)}
                      disabled={working !== null}
                      aria-label={`Allow downloads of ${item.title}`}
                    />
                    {working === item.id ? 'Saving…' : item.downloadable ? 'Download on' : 'Download off'}
                  </label>
                )}
                <Button size="sm" variant="ghost" icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => setPending(item)} disabled={working !== null} aria-label={`Remove ${item.title}`}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={pending !== null} title={`Remove “${pending?.title ?? ''}”?`} confirmLabel="Remove" onConfirm={() => void remove()} onCancel={() => setPending(null)}>
        The file and its preview are deleted from the repository in one commit, and the item leaves the gallery after the next deploy. Git history still keeps the old file.
      </ConfirmDialog>
    </section>
  );
}

/** The preview as served by this site; an icon until it is deployed (or when there is none). */
function Thumb({ item }: { item: PublishedItem }) {
  const [failed, setFailed] = useState(false);
  const Icon = item.kind === 'pbix' ? BarChart3 : Puzzle;
  if (item.preview && !failed) return <img className={styles.itemThumb} src={`/${item.preview.path}`} alt="" onError={() => setFailed(true)} />;
  return (
    <span className={styles.itemThumb}>
      <Icon size={20} aria-hidden="true" />
    </span>
  );
}
