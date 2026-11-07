import { useId, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { apiKeyStore, maskKey } from '@/services/assistant/apiKeyStore';
import { PROVIDERS, getProvider } from '@/services/assistant/providers';
import type { ProviderId } from '@/services/assistant/types';
import styles from './Assistant.module.css';

interface ApiKeyPanelProps {
  provider: ProviderId;
  model: string;
  apiKey: string | null;
  onProviderChange: (provider: ProviderId) => void;
  onModelChange: (model: string) => void;
  /** Called after a key is saved or forgotten for the current provider. */
  onKeyChange: (key: string | null) => void;
}

/** Choose the AI provider and model, and enter, show (masked) or forget the user's own key. */
export function ApiKeyPanel({ provider, model, apiKey, onProviderChange, onModelChange, onKeyChange }: ApiKeyPanelProps) {
  const [editing, setEditing] = useState(!apiKey);
  const [value, setValue] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const info = getProvider(provider);
  const modelInfo = info.models.find((m) => m.id === model);

  const chooseProvider = (next: ProviderId) => {
    setError(null);
    setValue('');
    setEditing(!apiKeyStore.get(next));
    onProviderChange(next);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!info.looksLikeKey(value)) {
      setError(`That does not look like a ${info.label} API key. ${info.keyHint}`);
      return;
    }
    try {
      apiKeyStore.set(provider, value, remember);
    } catch {
      setError('This browser blocks local storage, so the key cannot be kept. Allow site data and try again.');
      return;
    }
    setValue('');
    setError(null);
    setEditing(false);
    onKeyChange(value.trim());
  };

  const forget = () => {
    apiKeyStore.clear(provider);
    onKeyChange(null);
    setEditing(true);
  };

  const modelSelect = (
    <label className={styles.modelField}>
      <span>Model</span>
      <select value={model} onChange={(e) => onModelChange(e.target.value)} className={styles.select}>
        {info.models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.note}
          </option>
        ))}
      </select>
    </label>
  );

  if (apiKey && !editing) {
    return (
      <section className={styles.keyBar} aria-label="AI connection">
        <KeyRound size={16} aria-hidden="true" />
        <span>
          {info.label} · {modelInfo?.label ?? model} · key <code>{maskKey(apiKey)}</code>
          {apiKeyStore.isRemembered(provider) ? ' (remembered in this browser)' : ' (for this tab only)'}
        </span>
        <span className={styles.keyActions}>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Change
          </Button>
          <Button size="sm" variant="ghost" onClick={forget}>
            Forget key
          </Button>
        </span>
      </section>
    );
  }

  return (
    <section className={styles.keyPanel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.keyTitle}>
        <KeyRound size={18} aria-hidden="true" /> Connect an AI provider
      </h2>
      <div className={styles.providerRow}>
        <div role="radiogroup" aria-label="AI provider" className={styles.providers}>
          {PROVIDERS.map((p) => (
            <label key={p.id} className={styles.providerOption} data-checked={p.id === provider || undefined}>
              <input type="radio" name={`${id}-provider`} value={p.id} checked={p.id === provider} onChange={() => chooseProvider(p.id)} />
              {p.label}
            </label>
          ))}
        </div>
        {modelSelect}
      </div>
      <p className={styles.keyText}>
        The assistant uses your own {info.label} account; requests use that account’s quota or billing. Create a key in{' '}
        <a href={info.keyUrl} target="_blank" rel="noreferrer">
          {info.keyUrlLabel}
        </a>
        .
      </p>
      <form className={styles.keyForm} onSubmit={save} noValidate>
        <label htmlFor={`${id}-key`} className={styles.srOnly}>
          {info.label} API key
        </label>
        <input
          id={`${id}-key`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={info.keyPlaceholder}
          className={styles.keyInput}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Button type="submit" variant="primary">
          Save key
        </Button>
        {apiKey && (
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Done
          </Button>
        )}
      </form>
      <label className={styles.remember}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember the key in this browser
      </label>
      {error && (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
      {apiKey && <p className={styles.hint}>A key is already saved for {info.label}; enter a new one to replace it, or choose Done.</p>}
      <p className={styles.privacy}>
        <ShieldCheck size={15} aria-hidden="true" /> The key stays in this browser and is sent only to the {info.label} API, together with what you type here.
        Anyone using this browser profile could read a remembered key; use “Forget key” on shared computers.
      </p>
    </section>
  );
}
