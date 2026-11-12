import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { GithubConnection } from '@/components/admin/GithubConnection';
import { PublishForm } from '@/components/admin/PublishForm';
import { PublishedList } from '@/components/admin/PublishedList';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from '@/components/common/toastStore';
import type { PublishedManifest } from '@/domain/schemas/published';
import { createGithubPublisher, type GithubTarget } from '@/services/published/githubPublisher';
import { githubSettings } from '@/services/published/githubSettings';
import adminStyles from '@/components/admin/Admin.module.css';
import page from './Page.module.css';

function savedTarget(): GithubTarget | null {
  const token = githubSettings.getToken();
  return token ? { ...githubSettings.getRepo(), token } : null;
}

/**
 * Admin: publish .pbix reports and .pbiviz custom visuals to the gallery.
 * Not linked from the navigation; open /admin directly. Writing needs a GitHub
 * token with write access to the repository (docs/PUBLISHING.md).
 */
export function AdminPage() {
  const [target, setTarget] = useState<GithubTarget | null>(savedTarget);
  /** The list on the branch, tagged with the request it answers so a stale answer is ignored. */
  const [listing, setListing] = useState<{ request: number; manifest: PublishedManifest | null; error: string | null }>({ request: 0, manifest: null, error: null });
  const [request, setRequest] = useState(0);
  const current = listing.request === request ? listing : { manifest: null, error: null };
  const setManifest = useCallback((manifest: PublishedManifest) => setListing({ request, manifest, error: null }), [request]);

  useEffect(() => {
    if (!target) return;
    let active = true;
    createGithubPublisher(target)
      .readManifest()
      .then((manifest) => active && setListing({ request, manifest, error: null }))
      .catch((err: unknown) => active && setListing({ request, manifest: null, error: err instanceof Error ? err.message : 'The published files could not be listed.' }));
    return () => {
      active = false;
    };
  }, [target, request]);

  return (
    <div className={page.page}>
      <PageHeader title="Admin · Gallery publishing" description="Publish Power BI reports (.pbix) and custom visuals (.pbiviz) to the gallery’s “Power BI files” section." />
      <p className={`${adminStyles.note} ${adminStyles.pageNote}`}>
        <ShieldAlert size={15} aria-hidden="true" /> This page is reachable at /admin and is not linked anywhere. Only someone with a GitHub token that can write to the repository can publish
        or remove files; protect the page itself with Cloudflare Access (see docs/PUBLISHING.md).
      </p>
      <GithubConnection
        target={target}
        onConnected={(t) => {
          setTarget(t);
          setRequest((r) => r + 1);
        }}
      />
      {target && (
        <>
          <PublishForm
            target={target}
            onPublished={(m, title) => {
              setManifest(m);
              toast.success(`“${title}” was committed. It appears in the gallery after Cloudflare redeploys the site.`);
            }}
          />
          <PublishedList
            target={target}
            manifest={current.manifest}
            loadError={current.error}
            onReload={() => setRequest((r) => r + 1)}
            onChanged={(m, message) => {
              setManifest(m);
              toast.success(message);
            }}
          />
        </>
      )}
    </div>
  );
}
