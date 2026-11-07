import { NavLink } from 'react-router';
import { Menu } from 'lucide-react';
import { FUTURE_NAV_ITEMS, NAV_ITEMS, type NavItem } from './navItems';
import styles from './Sidebar.module.css';

function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink to={item.to} end={item.end} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`} onClick={onNavigate}>
        <Icon size={18} strokeWidth={1.9} aria-hidden="true" className={styles.icon} />
        {/* In the collapsed rail the label stays the link's accessible name and appears as a tooltip on hover/focus. */}
        <span className={styles.label}>{item.label}</span>
        {item.badge && <span className={styles.badge}>{item.badge}</span>}
      </NavLink>
    </li>
  );
}

export function Brand() {
  return (
    <div className={styles.brand}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--app-accent)" />
        <rect x="7" y="17" width="4" height="8" rx="1" fill="#fff" />
        <rect x="14" y="11" width="4" height="14" rx="1" fill="#fff" />
        <rect x="21" y="7" width="4" height="18" rx="1" fill="#a9bcff" />
      </svg>
      <span className={styles.brandName}>
        BI Design <strong>Studio</strong>
      </span>
    </div>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
  /** Desktop only: show the narrow icon rail. */
  collapsed?: boolean;
  /** Desktop only: toggle between the full sidebar and the icon rail. */
  onToggleCollapsed?: () => void;
}

export function Sidebar({ onNavigate, collapsed = false, onToggleCollapsed }: SidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Primary" data-collapsed={collapsed || undefined}>
      <div className={styles.brandRow}>
        {onToggleCollapsed && (
          <button
            type="button"
            className={styles.toggle}
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
        )}
        <div className={styles.brandWrap}>
          <Brand />
        </div>
      </div>
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => (
          <NavEntry key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </ul>
      {FUTURE_NAV_ITEMS.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Coming later</div>
          <ul className={styles.list}>
            {FUTURE_NAV_ITEMS.map((item) => (
              <NavEntry key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </ul>
        </>
      )}
      <div className={styles.footer}>
        <p>Designs are stored in this browser. Template and AI-drafted figures are fictional sample data; imported values are placeholders.</p>
      </div>
    </nav>
  );
}
