import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, CloudUpload, Loader2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import type { PublishedManifest } from '@/domain/schemas/published';
import { templateRepository } from '@/services/templateService';
import { createGithubPublisher, type GithubTarget } from '@/services/published/githubPublisher';
import { checkPreviewImage, inspectPowerBiFile, type InspectedFile } from '@/services/published/inspectFile';
import { formatBytes } from '@/services/published/manifest';
import { preparePublication } from '@/services/published/preparePublication';
import styles from './Admin.module.css';

interface PublishFormProps {
  target: GithubTarget;
  onPublished: (manifest: PublishedManifest, title: string) => void;
}

interface ChosenFile {
  name: string;
  bytes: Uint8Array;
  inspected: InspectedFile;
}

interface ChosenPreview {
  bytes: Uint8Array;
  ext: 'png' | 'jpg' | 'webp';
  url: string;
}

async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Choose a .pbix or .pbiviz file, a preview picture and the gallery details, then commit them to GitHub. */
export function PublishForm({ target, onPublished }: PublishFormProps) {
  const [file, setFile] = useState<ChosenFile | null>(null);
  const [preview, setPreview] = useState<ChosenPreview | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [downloadable, setDownloadable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const categories = templateRepository.listCategories();

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview]);

  const chooseFile = async (f: File | undefined) => {
    setError(null);
    setFile(null);
    if (!f) return;
    try {
      const bytes = await readBytes(f);
      const inspected = inspectPowerBiFile(f.name, bytes);
      setFile({ name: f.name, bytes, inspected });
      if (!title && inspected.title) setTitle(inspected.title.slice(0, 100));
      if (!description && inspected.description) setDescription(inspected.description.slice(0, 600));
    } catch (err) {
      if (fileRef.current) fileRef.current.value = '';
      setError(err instanceof Error ? err.message : 'The file could not be read.');
    }
  };

  const choosePreview = async (f: File | undefined) => {
    setError(null);
    setPreview(null);
    if (!f) return;
    try {
      const ext = checkPreviewImage(f);
      setPreview({ bytes: await readBytes(f), ext, url: URL.createObjectURL(f) });
    } catch (err) {
      if (previewRef.current) previewRef.current.value = '';
      setError(err instanceof Error ? err.message : 'The picture could not be read.');
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setTitle('');
    setDescription('');
    setCategoryId('');
    setTags('');
    setDownloadable(true);
    if (fileRef.current) fileRef.current.value = '';
    if (previewRef.current) previewRef.current.value = '';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Choose a .pbix or .pbiviz file.');
    if (title.trim().length < 2) return setError('Enter a title.');
    setError(null);
    setBusy(true);
    try {
      const { item, files } = preparePublication({ file, inspected: file.inspected, preview, title, description, categoryId, tags, downloadable });
      const manifest = await createGithubPublisher(target).publish(item, files);
      onPublished(manifest, item.title);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.panelTitle}>
        <CloudUpload size={18} aria-hidden="true" /> Publish a Power BI file
      </h2>
      <p className={styles.text}>
        Publish a report (.pbix) or a custom visual (.pbiviz), up to 25 MB. It appears in the gallery’s “Power BI files” section for everyone once Cloudflare has redeployed
        the site, usually within a few minutes. Remove any confidential data from the file first: anyone can download it.
      </p>
      <form onSubmit={(e) => void submit(e)} noValidate aria-busy={busy}>
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.wide}`}>
            Power BI file
            <input
              ref={fileRef}
              className={styles.fileInput}
              type="file"
              accept=".pbix,.pbiviz"
              onChange={(e) => void chooseFile(e.target.files?.[0])}
              disabled={busy}
            />
            {file && (
              <span className={styles.checked}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {file.inspected.kind === 'pbix' ? 'Power BI report' : `Custom visual${file.inspected.visual ? ` v${file.inspected.visual.version}` : ''}`} · {formatBytes(file.bytes.byteLength)} · checked
              </span>
            )}
          </label>
          <label className={styles.field}>
            Title
            <input className={styles.input} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>
              Category <span className={styles.optional}>(optional)</span>
            </span>
            <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={busy}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.field} ${styles.wide}`}>
            <span>
              Description <span className={styles.optional}>(optional)</span>
            </span>
            <textarea className={styles.textarea} value={description} maxLength={600} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>
              Tags <span className={styles.optional}>(optional, comma-separated)</span>
            </span>
            <input className={styles.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Sales, KPI, Monthly" disabled={busy} />
          </label>
          <label className={styles.field}>
            <span>
              Preview picture <span className={styles.optional}>(recommended)</span>
            </span>
            <input
              ref={previewRef}
              className={styles.fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void choosePreview(e.target.files?.[0])}
              disabled={busy}
            />
            <span className={styles.help}>A screenshot of the report or visual: PNG, JPEG or WebP, up to 2 MB, ideally 16:10.</span>
          </label>
          {preview && <img src={preview.url} alt="Chosen preview" className={styles.previewThumb} />}
          {file?.inspected.kind === 'pbiviz' && (
            <div className={`${styles.field} ${styles.wide}`}>
              <label className={styles.switch}>
                <input type="checkbox" role="switch" checked={downloadable} onChange={(e) => setDownloadable(e.target.checked)} disabled={busy} />
                Allow visitors to download this custom visual
              </label>
              <span className={styles.help}>
                {downloadable
                  ? 'The gallery card shows a download button.'
                  : 'The gallery shows the card without a download button, and the file is kept outside the website’s files, so it cannot be fetched from the site. You can change this later in the list below.'}
              </span>
            </div>
          )}
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.row}>
          <Button type="submit" variant="primary" disabled={busy} icon={busy ? <Loader2 size={16} className={styles.spin} aria-hidden="true" /> : <CloudUpload size={16} aria-hidden="true" />}>
            {busy ? 'Publishing…' : 'Publish to gallery'}
          </Button>
        </div>
      </form>
    </section>
  );
}
