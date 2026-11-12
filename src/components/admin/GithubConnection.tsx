import { useId, useState, type FormEvent } from 'react';
import { CheckCircle2, GitBranch, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { createGithubPublisher, type GithubTarget } from '@/services/published/githubPublisher';
import { githubSettings, looksLikeGithubToken, type RepoSettings } from '@/services/published/githubSettings';
import styles from './Admin.module.css';

interface GithubConnectionProps {
  /** The checked connection, or null when not connected. */
  target: GithubTarget | null;
  onConnected: (target: GithubTarget | null) => void;
}

/** Enter the repository and a GitHub token, check write access, then show the connection. */
export function GithubConnection({ target, onConnected }: GithubConnectionProps) {
  const [repo, setRepo] = useState<RepoSettings>(() => (target ? { owner: target.owner, repo: target.repo, branch: target.branch } : githubSettings.getRepo()));
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [editing, setEditing] = useState(!target);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    const clean = { owner: repo.owner.trim(), repo: repo.repo.trim(), branch: repo.branch.trim() };
    const value = token.trim() || target?.token || '';
    if (!clean.owner || !clean.repo || !clean.branch) return setError('Fill in the owner, repository and branch.');
    if (!looksLikeGithubToken(value)) return setError('Enter a GitHub token (it starts with github_pat_ or ghp_).');
    setChecking(true);
    setError(null);
    try {
      const next = { ...clean, token: value };
      await createGithubPublisher(next).verify();
      githubSettings.setRepo(clean);
      try {
        githubSettings.setToken(value, remember);
      } catch {
        /* storage blocked: the connection still works for this page view */
      }
      setToken('');
      setEditing(false);
      onConnected(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The connection could not be checked.');
    } finally {
      setChecking(false);
    }
  };

  const disconnect = () => {
    githubSettings.clearToken();
    setEditing(true);
    onConnected(null);
  };

  if (target && !editing) {
    return (
      <section className={styles.panel} aria-label="GitHub connection">
        <p className={styles.status}>
          <CheckCircle2 size={16} className={styles.ok} aria-hidden="true" />
          Connected to <strong>
            {target.owner}/{target.repo}
          </strong>{' '}
          (branch {target.branch}){githubSettings.isRemembered() ? ', token remembered in this browser' : ', token kept for this tab only'}.
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Change
          </Button>
          <Button size="sm" variant="ghost" onClick={disconnect}>
            Forget token
          </Button>
        </p>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.panelTitle}>
        <GitBranch size={18} aria-hidden="true" /> Connect the site’s GitHub repository
      </h2>
      <p className={styles.text}>
        Publishing commits the file to the repository the site is deployed from; Cloudflare then redeploys the site. Create a{' '}
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
          fine-grained token
        </a>{' '}
        with access to this repository only and the permission <strong>Contents: Read and write</strong>.
      </p>
      <form onSubmit={(e) => void connect(e)} noValidate>
        <div className={styles.grid}>
          <label className={styles.field}>
            Owner
            <input className={styles.input} value={repo.owner} onChange={(e) => setRepo({ ...repo, owner: e.target.value })} autoComplete="off" spellCheck={false} />
          </label>
          <label className={styles.field}>
            Repository
            <input className={styles.input} value={repo.repo} onChange={(e) => setRepo({ ...repo, repo: e.target.value })} autoComplete="off" spellCheck={false} />
          </label>
          <label className={styles.field}>
            Branch
            <input className={styles.input} value={repo.branch} onChange={(e) => setRepo({ ...repo, branch: e.target.value })} autoComplete="off" spellCheck={false} />
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            GitHub token
            <input
              className={styles.input}
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={target ? 'Leave empty to keep the current token' : 'github_pat_…'}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </label>
        </div>
        <div className={styles.row}>
          <Button type="submit" variant="primary" disabled={checking} icon={checking ? <Loader2 size={16} className={styles.spin} aria-hidden="true" /> : undefined}>
            {checking ? 'Checking…' : 'Connect'}
          </Button>
          {target && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
          <label className={styles.checkbox}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember the token in this browser
          </label>
        </div>
        {error && (
          <p id={`${id}-error`} className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
      <p className={styles.note}>
        <ShieldCheck size={15} aria-hidden="true" /> The token stays in this browser and is sent only to api.github.com. Anyone with this browser profile could read a remembered
        token; use “Forget token” on shared computers.
      </p>
    </section>
  );
}
