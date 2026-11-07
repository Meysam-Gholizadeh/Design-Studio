import { FileUp, Home, LayoutGrid, Palette, PencilRuler, Sparkles, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Small badge shown after the label (e.g. "Soon"). */
  badge?: string;
  end?: boolean;
}

/**
 * Primary navigation. Sections are added here as they become functional, so
 * the sidebar never links to unfinished screens.
 * Planned: My Designs (phase 5).
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/gallery', label: 'Dashboard Gallery', icon: LayoutGrid },
  { to: '/themes', label: 'Themes & Layouts', icon: Palette },
  { to: '/editor', label: 'Dashboard Editor', icon: PencilRuler },
  { to: '/import', label: 'Import HTML', icon: FileUp },
  { to: '/assistant', label: 'AI Design Assistant', icon: Sparkles },
];

/** Listed under a "Coming later" heading (hidden when empty); they lead to honest informational pages. */
export const FUTURE_NAV_ITEMS: NavItem[] = [];
