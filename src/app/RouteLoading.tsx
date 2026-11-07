import styles from './RouteLoading.module.css';

/** Shown while a lazily loaded route is fetched on first load. */
export function RouteLoading() {
  return (
    <div className={styles.loading} role="status" aria-label="Loading">
      <span className={styles.bar} />
    </div>
  );
}
