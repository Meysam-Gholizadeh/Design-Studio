import { Briefcase, Dumbbell, Factory, GraduationCap, HeartPulse, Landmark, LayoutGrid, ShoppingCart, TrendingUp, Users, type LucideIcon, type LucideProps } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  healthcare: HeartPulse,
  education: GraduationCap,
  fitness: Dumbbell,
  finance: Landmark,
  operations: Factory,
  hr: Users,
  sales: TrendingUp,
  procurement: ShoppingCart,
  executive: Briefcase,
};

/** Icon for a category's icon key; falls back to a neutral grid icon. */
export function CategoryIcon({ icon, ...props }: { icon?: string } & LucideProps) {
  const Icon = (icon && ICONS[icon]) || LayoutGrid;
  return <Icon aria-hidden="true" {...props} />;
}
