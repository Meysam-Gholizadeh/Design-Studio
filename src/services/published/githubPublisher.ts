/**
 * Publishes gallery files by committing them to the site's GitHub repository
 * with the Git Data API (blobs → tree → commit → move the branch). Each publish
 * or removal is one commit that also updates `public/published/manifest.json`;
 * the host (Cloudflare) redeploys the site from the new commit.
 *
 * Runs in the browser with the admin's own fine-grained token (Contents:
 * read and write on this one repository). Nothing else holds the token.
 */
import { EMPTY_MANIFEST, type PublishedItem, type PublishedManifest } from '@/domain/schemas/published';
import { MANIFEST_REPO_PATH, addItem, fileRepoPath, parseManifest, removeItem, serializeManifest, setItemDownloadable } from './manifest';

export interface GithubTarget {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface FileToCommit {
  /** Path in the repository, e.g. `public/published/<id>/report.pbix`. */
  path: string;
  bytes: Uint8Array;
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const API = 'https://api.github.com';

export function createGithubPublisher(target: GithubTarget, fetchImpl: FetchLike = (i, init) => fetch(i, init)) {
  const repoPath = `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`;

  async function call<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<{ status: number; data: T | null }> {
    let res: Response;
    try {
      res = await fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${target.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GithubError('GitHub could not be reached. Check your internet connection and try again.');
    }
    if (res.ok) return { status: res.status, data: (await res.json()) as T };
    if (okStatuses.includes(res.status)) return { status: res.status, data: null };
    throw new GithubError(await describeFailure(res, target), res.status);
  }

  async function headCommit(): Promise<{ commitSha: string; treeSha: string }> {
    const ref = await call<{ object: { sha: string } }>('GET', `${repoPath}/git/ref/heads/${encodeURIComponent(target.branch)}`);
    const commitSha = ref.data!.object.sha;
    const commit = await call<{ tree: { sha: string } }>('GET', `${repoPath}/git/commits/${commitSha}`);
    return { commitSha, treeSha: commit.data!.tree.sha };
  }

  async function manifestAt(commitSha: string): Promise<PublishedManifest> {
    const res = await call<{ content?: string; encoding?: string }>('GET', `${repoPath}/contents/${MANIFEST_REPO_PATH}?ref=${commitSha}`, undefined, [404]);
    if (!res.data) return EMPTY_MANIFEST;
    if (res.data.encoding !== 'base64' || typeof res.data.content !== 'string') throw new GithubError('The gallery list in the repository could not be read.');
    return parseManifest(decodeBase64Text(res.data.content));
  }

  async function blob(content: string, encoding: 'base64' | 'utf-8'): Promise<string> {
    const res = await call<{ sha: string }>('POST', `${repoPath}/git/blobs`, { content, encoding });
    return res.data!.sha;
  }

  /** Blob id of a file on the branch (works for files of any size; the content is not downloaded). */
  async function blobShaAt(commitSha: string, path: string): Promise<string | null> {
    const res = await call<{ sha?: string }>('GET', `${repoPath}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${commitSha}`, undefined, [404]);
    return res.data?.sha ?? null;
  }

  interface Plan {
    next: PublishedManifest;
    files?: FileToCommit[];
    /** Existing blobs placed at a new path (a move without re-uploading). */
    copies?: Array<{ path: string; sha: string }>;
    deletes?: string[];
  }

  /** One commit built from the manifest on the branch: new files, copies, deletions and the rewritten manifest. */
  async function commit(message: string, planFor: (manifest: PublishedManifest, commitSha: string) => Promise<Plan> | Plan): Promise<PublishedManifest> {
    const head = await headCommit();
    const plan = await planFor(await manifestAt(head.commitSha), head.commitSha);
    const next = plan.next;
    const entries: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string | null }> = [];
    for (const f of plan.files ?? []) entries.push({ path: f.path, mode: '100644', type: 'blob', sha: await blob(encodeBase64(f.bytes), 'base64') });
    for (const c of plan.copies ?? []) entries.push({ path: c.path, mode: '100644', type: 'blob', sha: c.sha });
    entries.push({ path: MANIFEST_REPO_PATH, mode: '100644', type: 'blob', sha: await blob(serializeManifest(next), 'utf-8') });
    for (const p of plan.deletes ?? []) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });

    const tree = await call<{ sha: string }>('POST', `${repoPath}/git/trees`, { base_tree: head.treeSha, tree: entries });
    const created = await call<{ sha: string }>('POST', `${repoPath}/git/commits`, { message, tree: tree.data!.sha, parents: [head.commitSha] });
    try {
      await call('PATCH', `${repoPath}/git/refs/heads/${encodeURIComponent(target.branch)}`, { sha: created.data!.sha, force: false });
    } catch (err) {
      if (err instanceof GithubError && err.status === 422) {
        throw new GithubError(`The ${target.branch} branch changed while publishing (someone pushed a commit). Nothing was changed; try again.`, 422);
      }
      throw err;
    }
    return next;
  }

  return {
    /** Check the repository is reachable and the token may write to it. */
    async verify(): Promise<{ fullName: string }> {
      const res = await call<{ full_name: string; permissions?: { push?: boolean } }>('GET', repoPath);
      if (!res.data!.permissions?.push) throw new GithubError(`The token can read ${res.data!.full_name} but cannot write to it. Give it “Contents: Read and write” access.`, 403);
      await headCommit();
      return { fullName: res.data!.full_name };
    },

    /** The gallery list as it is on the branch now (may be ahead of the deployed site). */
    async readManifest(): Promise<PublishedManifest> {
      const head = await headCommit();
      return manifestAt(head.commitSha);
    },

    publish(item: PublishedItem, files: FileToCommit[]): Promise<PublishedManifest> {
      return commit(`Publish ${item.kind === 'pbix' ? 'report' : 'custom visual'} "${item.title}" to the gallery`, (m) => ({ next: addItem(m, item), files }));
    },

    remove(item: PublishedItem): Promise<PublishedManifest> {
      return commit(`Remove "${item.title}" from the gallery`, (m) => {
        // Use the branch's copy: its download setting says where the file is.
        const current = m.items.find((i) => i.id === item.id) ?? item;
        const deletes = [fileRepoPath(current, current.downloadable), ...(current.preview ? [`public/${current.preview.path}`] : [])];
        return { next: removeItem(m, item.id), deletes };
      });
    },

    /**
     * Turn downloading on or off: moves the file into or out of the served
     * `public/` folder (same blob, nothing re-uploaded) and updates the list.
     */
    setDownloadable(item: PublishedItem, downloadable: boolean): Promise<PublishedManifest> {
      return commit(`${downloadable ? 'Allow' : 'Stop'} downloads of "${item.title}"`, async (m, commitSha) => {
        const current = m.items.find((i) => i.id === item.id);
        if (!current) throw new GithubError(`“${item.title}” is no longer published on the ${target.branch} branch. Reload the list.`);
        if (current.downloadable === downloadable) return { next: m };
        const from = fileRepoPath(current, current.downloadable);
        const sha = await blobShaAt(commitSha, from);
        if (!sha) throw new GithubError(`The file for “${item.title}” was not found at ${from}. Remove the item and publish it again.`);
        return { next: setItemDownloadable(m, item.id, downloadable), copies: [{ path: fileRepoPath(current, downloadable), sha }], deletes: [from] };
      });
    },
  };
}

export type GithubPublisher = ReturnType<typeof createGithubPublisher>;

async function describeFailure(res: Response, target: GithubTarget): Promise<string> {
  let detail = '';
  try {
    const body = (await res.json()) as { message?: string };
    detail = body.message ?? '';
  } catch {
    /* no JSON body */
  }
  const repo = `${target.owner}/${target.repo}`;
  switch (res.status) {
    case 401:
      return 'GitHub rejected the token (it is wrong, expired or revoked). Create a new one and save it again.';
    case 403:
      return /rate limit/i.test(detail) ? 'GitHub’s rate limit was reached. Wait a few minutes and try again.' : `The token is not allowed to do this on ${repo}. Give it “Contents: Read and write” access to this repository.`;
    case 404:
      return `${repo} (branch ${target.branch}) was not found, or the token cannot see it. Check the repository settings and the token’s repository access.`;
    case 409:
      return `The ${repo} repository is empty or blocked. Push at least one commit first.`;
    case 422:
      return detail ? `GitHub refused the change: ${detail}.` : 'GitHub refused the change.';
    default:
      return `GitHub returned an error (${res.status}${detail ? `: ${detail}` : ''}).`;
  }
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function decodeBase64Text(content: string): string {
  const binary = atob(content.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
