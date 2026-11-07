import { Link } from 'react-router';
import { FileUp, LayoutGrid, SquarePlus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { RecentDesigns } from '@/components/designs/RecentDesigns';
import page from './Page.module.css';
import styles from './EditorLauncherPage.module.css';

/** Entry point for "Dashboard Editor": start something new or continue a saved design. */
export function EditorLauncherPage() {
  return (
    <div className={page.page}>
      <PageHeader title="Dashboard Editor" description="Start a new design or continue where you left off." />
      <div className={styles.starts}>
        <Link to="/editor/new" className={styles.start} data-primary>
          <span className={styles.startIcon}>
            <SquarePlus size={22} aria-hidden="true" />
          </span>
          <span>
            <span className={styles.startTitle}>Create from blank</span>
            <span className={styles.startText}>An empty canvas — drag visuals from the library to build your own layout.</span>
          </span>
        </Link>
        <Link to="/gallery" className={styles.start}>
          <span className={styles.startIcon}>
            <LayoutGrid size={22} aria-hidden="true" />
          </span>
          <span>
            <span className={styles.startTitle}>Start with a template</span>
            <span className={styles.startText}>Pick a professional design for your business area and customize it.</span>
          </span>
        </Link>
        <Link to="/import" className={styles.start}>
          <span className={styles.startIcon}>
            <FileUp size={22} aria-hidden="true" />
          </span>
          <span>
            <span className={styles.startTitle}>Import an HTML dashboard</span>
            <span className={styles.startText}>Convert a dashboard built as a web page — e.g. by an AI assistant — into an editable design.</span>
          </span>
        </Link>
      </div>
      <div className={page.section}>
        <RecentDesigns limit={12} title="Your designs" emptyState={<p className={styles.none}>You haven’t saved any designs yet. They’ll appear here.</p>} />
      </div>
    </div>
  );
}
