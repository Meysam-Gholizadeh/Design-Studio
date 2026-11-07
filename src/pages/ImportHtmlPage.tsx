import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from '@/components/common/toastStore';
import { DashboardPreview } from '@/components/dashboard/DashboardPreview';
import { HtmlDropZone } from '@/components/import/HtmlDropZone';
import { ImportReport } from '@/components/import/ImportReport';
import { SandboxedPage } from '@/components/import/SandboxedPage';
import { designRepository } from '@/services/designRepository';
import { convertExtraction, type ImportResult } from '@/services/htmlImport/convert/convertExtraction';
import { awaitExtraction, createNonce, prepareSrcdoc, readHtmlFile } from '@/services/htmlImport/sandbox';
import page from './Page.module.css';
import styles from './ImportHtmlPage.module.css';

type State =
  | { step: 'idle' }
  | { step: 'analysing'; fileName: string; srcDoc: string; nonce: string }
  | { step: 'done'; fileName: string; srcDoc: string; result: ImportResult }
  | { step: 'failed'; fileName: string; error: string };

type View = 'converted' | 'original';

/** "Import HTML": turn an HTML dashboard into an editable design (then export it to Power BI from the editor). */
export function ImportHtmlPage() {
  const [state, setState] = useState<State>({ step: 'idle' });
  const [view, setView] = useState<View>('converted');
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [opening, setOpening] = useState(false);
  const navigate = useNavigate();

  const onFile = async (file: File) => {
    try {
      const html = await readHtmlFile(file);
      const nonce = createNonce();
      setView('converted');
      setState({ step: 'analysing', fileName: file.name, srcDoc: prepareSrcdoc(html, nonce), nonce });
    } catch (err) {
      setState({ step: 'failed', fileName: file.name, error: err instanceof Error ? err.message : 'The file could not be read.' });
    }
  };

  useEffect(() => {
    if (state.step !== 'analysing' || !frame) return;
    const controller = new AbortController();
    awaitExtraction(frame, state.nonce, controller.signal)
      .then((raw) => {
        const result = convertExtraction(raw, state.fileName);
        setState({ step: 'done', fileName: state.fileName, srcDoc: state.srcDoc, result });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({ step: 'failed', fileName: state.fileName, error: err instanceof Error ? err.message : 'The page could not be analysed.' });
      });
    return () => controller.abort();
  }, [state, frame]);

  const openInEditor = async () => {
    if (state.step !== 'done') return;
    setOpening(true);
    try {
      await designRepository.save(state.result.document);
      navigate(`/editor/${state.result.document.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The design could not be saved.');
      setOpening(false);
    }
  };

  const reset = () => setState({ step: 'idle' });

  return (
    <div className={page.page}>
      <PageHeader
        title="Import HTML dashboard"
        description="Turn a dashboard built as a web page — for example by an AI assistant — into an editable design. Review it in the editor, then export it as a Power BI project."
        actions={
          state.step === 'done' ? (
            <>
              <Button icon={<RotateCcw size={16} aria-hidden="true" />} onClick={reset}>
                Import another file
              </Button>
              <Button variant="primary" iconRight={<ArrowRight size={16} aria-hidden="true" />} onClick={() => void openInEditor()} disabled={opening}>
                Open in editor
              </Button>
            </>
          ) : undefined
        }
      />

      {(state.step === 'idle' || state.step === 'failed') && (
        <>
          {state.step === 'failed' && (
            <div className={styles.error} role="alert">
              <strong>{state.fileName} could not be imported.</strong> {state.error}
            </div>
          )}
          <HtmlDropZone onFile={(f) => void onFile(f)} />
          <div className={styles.info}>
            <div>
              <h2 className={styles.infoTitle}>What converts</h2>
              <ul className={styles.list}>
                <li>Charts made with Chart.js, ECharts, Plotly, Highcharts or ApexCharts — with their data: bar, stacked, line, area, combo, pie, donut, gauge.</li>
                <li>KPI cards (value, change versus a period, target), HTML tables, dropdown and button filters, headings and images.</li>
                <li>The layout and the colours of the page.</li>
              </ul>
            </div>
            <div>
              <h2 className={styles.infoTitle}>Good to know</h2>
              <ul className={styles.list}>
                <li>Other charts (scatter, maps, hand-drawn SVG) come in as pictures for you to replace.</li>
                <li>The numbers are copied from your file as placeholders; connect real data in Power BI.</li>
                <li className={styles.safe}>
                  <ShieldCheck size={15} aria-hidden="true" /> The file stays in this browser. Its scripts run in an isolated sandbox and may load chart libraries from the internet.
                </li>
              </ul>
            </div>
          </div>
        </>
      )}

      {(state.step === 'analysing' || state.step === 'done') && (
        <div className={styles.workspace}>
          {state.step === 'analysing' ? (
            <p className={styles.progress} role="status">
              <Loader2 size={16} className={styles.spin} aria-hidden="true" /> Analysing {state.fileName}… Charts are read once the page has finished drawing.
            </p>
          ) : (
            <div role="tablist" aria-label="Compare" className={styles.tabs}>
              {(['converted', 'original'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} className={styles.tab} onClick={() => setView(v)}>
                  {v === 'converted' ? 'Converted design' : 'Your HTML page'}
                </button>
              ))}
            </div>
          )}
          {state.step === 'done' && view === 'converted' && <DashboardPreview document={state.result.document} />}
          <SandboxedPage srcDoc={state.srcDoc} frameRef={setFrame} hidden={state.step === 'done' && view !== 'original'} />
          {state.step === 'done' && <ImportReport items={state.result.items} notes={state.result.notes} />}
        </div>
      )}
    </div>
  );
}
