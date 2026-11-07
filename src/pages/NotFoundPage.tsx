import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import page from './Page.module.css';
import styles from './InfoPage.module.css';

export function NotFoundPage() {
  return (
    <div className={page.page}>
      <PageHeader title="Page not found" />
      <div className={styles.panel}>
        <span className={styles.icon}>
          <Compass size={22} aria-hidden="true" />
        </span>
        <div>
          <p className={styles.lead}>We couldn’t find that page.</p>
          <p className={styles.body}>The link may be out of date. Head back home to continue.</p>
          <div className={styles.actions}>
            <ButtonLink to="/" variant="primary">
              Go to Home
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
