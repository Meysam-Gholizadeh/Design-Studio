import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Menu, X } from 'lucide-react';
import { IconButton } from '@/components/common/Button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Brand, Sidebar } from './navigation/Sidebar';
import styles from './AppShell.module.css';

const COLLAPSED_KEY = 'bi-design-studio:sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable (private mode): the choice simply isn't remembered.
  }
}

/**
 * Responsive application shell: sidebar on desktop (full or collapsed to an
 * icon rail, remembered per browser), drawer on narrow screens.
 */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(readCollapsed);
  const desktop = useMediaQuery('(min-width: 901px)');
  const collapsed = desktop && collapsedPref;
  const location = useLocation();

  // Reset scroll on navigation (the drawer closes itself via onNavigate).
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsedPref((v) => {
      writeCollapsed(!v);
      return !v;
    });
  };

  return (
    <div className={styles.shell} data-collapsed={collapsed || undefined}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.topbar}>
        <IconButton label="Open navigation" icon={<Menu size={20} />} onClick={() => setDrawerOpen(true)} aria-expanded={drawerOpen} />
        <Brand />
      </header>
      <aside className={styles.sidebar} data-open={drawerOpen || undefined}>
        <div className={styles.drawerClose}>
          <IconButton label="Close navigation" icon={<X size={20} />} onClick={() => setDrawerOpen(false)} />
        </div>
        <Sidebar onNavigate={() => setDrawerOpen(false)} collapsed={collapsed} onToggleCollapsed={desktop ? toggleCollapsed : undefined} />
      </aside>
      {drawerOpen && <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <main id="main-content" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
