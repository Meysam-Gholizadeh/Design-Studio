import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { Paintbrush } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { toast } from '@/components/common/toastStore';
import { designRepository, type DesignSummary } from '@/services/designRepository';
import { setTheme } from '@/state/layoutOps';
import styles from './ApplyThemeToDesign.module.css';

/** Apply a theme to one of the saved designs, then open it. Only shown when designs exist. */
export function ApplyThemeToDesign({ themeId, themeName }: { themeId: string; themeName: string }) {
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const id = useId();

  useEffect(() => {
    let alive = true;
    designRepository.list().then(
      (list) => {
        if (!alive) return;
        setDesigns(list);
        setTarget(list[0]?.id ?? '');
      },
      () => alive && setDesigns([]),
    );
    return () => {
      alive = false;
    };
  }, []);

  if (!designs?.length) return null;

  const apply = async () => {
    setBusy(true);
    try {
      const doc = await designRepository.get(target);
      if (!doc) throw new Error('That design no longer exists.');
      const r = setTheme(doc, themeId);
      if (!r.ok) throw new Error(r.reason);
      await designRepository.save({ ...r.value, updatedAt: new Date().toISOString() });
      toast.success(`Applied ${themeName} to “${doc.name}”.`);
      navigate(`/editor/${doc.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The theme could not be applied.');
      setBusy(false);
    }
  };

  return (
    <div className={styles.row}>
      <label htmlFor={id} className={styles.label}>
        Apply to a saved design
      </label>
      <select id={id} className={styles.select} value={target} onChange={(e) => setTarget(e.target.value)}>
        {designs.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <Button icon={<Paintbrush size={15} aria-hidden="true" />} onClick={() => void apply()} disabled={busy || !target}>
        Apply {themeName}
      </Button>
    </div>
  );
}
