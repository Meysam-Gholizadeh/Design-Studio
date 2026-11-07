import { isRouteErrorResponse, useRouteError } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import styles from './RouteError.module.css';

/** Last-resort error screen for routing or render failures. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unknown error';
  return (
    <div className={styles.wrap} role="alert">
      <AlertTriangle size={28} aria-hidden="true" />
      <h1>Something went wrong</h1>
      <p>The page couldn’t be displayed. Your saved designs are not affected.</p>
      <pre className={styles.detail}>{message}</pre>
      <a href="/" className={styles.link}>
        Reload the studio
      </a>
    </div>
  );
}
