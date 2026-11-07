import { FileUp, FolderOpen, LayoutGrid, Palette, Share2, Sparkles, SquarePlus, type LucideIcon } from 'lucide-react';

export interface Tool {
  to: string;
  title: string;
  text: string;
  /** Short call to action shown at the bottom of the card. */
  action: string;
  icon: LucideIcon;
  /** Accent of the card's icon and hover glow (see ToolGrid.module.css). */
  tone: 'blue' | 'indigo' | 'ai' | 'orange' | 'violet' | 'teal' | 'amber';
  /** Columns the card spans in the four-column bento grid (default 1). */
  span?: 2 | 4;
}

/** Every tool the studio offers; each card opens a working section. */
export function studioTools(templateCount: number): Tool[] {
  return [
    {
      to: '/gallery',
      title: 'Dashboard Gallery',
      text: `${templateCount} professionally designed templates by business area. Open any one as your own editable copy.`,
      action: 'Browse templates',
      icon: LayoutGrid,
      tone: 'blue',
      span: 2,
    },
    { to: '/editor/new', title: 'Start from blank', text: 'Drag visuals onto an empty canvas and compose your own design.', action: 'New design', icon: SquarePlus, tone: 'indigo' },
    { to: '/import', title: 'Import HTML', text: 'Turn an HTML dashboard into an editable design.', action: 'Import a file', icon: FileUp, tone: 'orange' },
    {
      to: '/assistant',
      title: 'AI Design Assistant',
      text: 'Describe the dashboard you need and let Claude, Gemini or OpenAI draft it — then refine it in conversation.',
      action: 'Describe a dashboard',
      icon: Sparkles,
      tone: 'ai',
      span: 2,
    },
    { to: '/themes', title: 'Themes & Layouts', text: 'Pick a colour theme and a page composition to start from.', action: 'Explore styles', icon: Palette, tone: 'violet' },
    { to: '/editor', title: 'Open a saved design', text: 'Continue where you left off; designs are saved in this browser.', action: 'My designs', icon: FolderOpen, tone: 'teal' },
    {
      to: '/editor',
      title: 'Export to Power BI',
      text: 'Open a design, then export it as a Power BI project (PBIP), an HTML page or a developer handoff spec.',
      action: 'Open a design to export',
      icon: Share2,
      tone: 'amber',
      span: 4,
    },
  ];
}
