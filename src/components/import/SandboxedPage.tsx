import { ScaledFrame } from '@/components/dashboard/ScaledFrame';
import { SANDBOX_ATTRIBUTE, SANDBOX_VIEWPORT } from '@/services/htmlImport/sandbox';
import styles from './SandboxedPage.module.css';

interface SandboxedPageProps {
  srcDoc: string;
  frameRef: (el: HTMLIFrameElement | null) => void;
  hidden?: boolean;
}

/**
 * The uploaded page, rendered in an isolated iframe at the design width and
 * scaled to fit. `sandbox="allow-scripts"` lets its charts draw while keeping
 * it away from the studio (opaque origin: no storage, cookies or navigation).
 */
export function SandboxedPage({ srcDoc, frameRef, hidden }: SandboxedPageProps) {
  return (
    <div className={styles.wrap} hidden={hidden}>
      <ScaledFrame width={SANDBOX_VIEWPORT.width} height={SANDBOX_VIEWPORT.height}>
        <iframe
          ref={frameRef}
          className={styles.frame}
          title="Your uploaded dashboard (isolated preview)"
          sandbox={SANDBOX_ATTRIBUTE}
          referrerPolicy="no-referrer"
          srcDoc={srcDoc}
          width={SANDBOX_VIEWPORT.width}
          height={SANDBOX_VIEWPORT.height}
        />
      </ScaledFrame>
    </div>
  );
}
