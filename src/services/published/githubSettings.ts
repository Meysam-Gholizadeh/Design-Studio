/**
 * The admin's GitHub connection, kept in this browser only. The repository
 * settings are a convenience in local storage; the token goes to local storage
 * only when "remember" is on, otherwise to this tab's session storage.
 */
import type { GithubTarget } from './githubPublisher';

const PREFIX = 'bi-design-studio:publish-';
const REPO_KEY = `${PREFIX}repo`;
const TOKEN_KEY = `${PREFIX}github-token`;

/** This project's repository (from .git/config); editable on the admin page. */
export const DEFAULT_REPO = { owner: 'Meysam-Gholizadeh', repo: 'Design-Studio', branch: 'main' } as const;

export type RepoSettings = Omit<GithubTarget, 'token'>;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const githubSettings = {
  getRepo(): RepoSettings {
    const raw = safe(() => window.localStorage.getItem(REPO_KEY), null);
    if (!raw) return { ...DEFAULT_REPO };
    const parsed = safe<unknown>(() => JSON.parse(raw), null);
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      if (typeof p.owner === 'string' && typeof p.repo === 'string' && typeof p.branch === 'string') return { owner: p.owner, repo: p.repo, branch: p.branch };
    }
    return { ...DEFAULT_REPO };
  },
  setRepo(repo: RepoSettings): void {
    safe(() => window.localStorage.setItem(REPO_KEY, JSON.stringify(repo)), undefined);
  },
  getToken(): string | null {
    return safe(() => window.sessionStorage.getItem(TOKEN_KEY), null) ?? safe(() => window.localStorage.getItem(TOKEN_KEY), null);
  },
  isRemembered(): boolean {
    return Boolean(safe(() => window.localStorage.getItem(TOKEN_KEY), null));
  },
  /** Throws when the browser blocks storage. */
  setToken(token: string, remember: boolean): void {
    this.clearToken();
    (remember ? window.localStorage : window.sessionStorage).setItem(TOKEN_KEY, token.trim());
  },
  clearToken(): void {
    safe(() => window.localStorage.removeItem(TOKEN_KEY), undefined);
    safe(() => window.sessionStorage.removeItem(TOKEN_KEY), undefined);
  },
};

/** GitHub tokens: classic `ghp_…` or fine-grained `github_pat_…`. */
export function looksLikeGithubToken(value: string): boolean {
  return /^(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})$/.test(value.trim());
}
