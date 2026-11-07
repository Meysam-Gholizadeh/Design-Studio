import type { Category } from '@/domain/schemas/catalog';

export const CATEGORIES: readonly Category[] = [
  { id: 'finance', name: 'Finance & Controlling', description: 'Revenue, costs, margins, budgets and cash.', icon: 'finance' },
  { id: 'operations', name: 'Operations', description: 'Throughput, efficiency, quality, inventory and service levels.', icon: 'operations' },
  { id: 'hr', name: 'Human Resources', description: 'Headcount, recruitment, retention and workforce mix.', icon: 'hr' },
  { id: 'sales-marketing', name: 'Sales & Marketing', description: 'Revenue, targets, pipeline and campaign performance.', icon: 'sales' },
  { id: 'procurement', name: 'Procurement', description: 'Spend, savings, suppliers and purchase orders.', icon: 'procurement' },
  { id: 'executive', name: 'Executive Management', description: 'Strategic KPIs across the whole business.', icon: 'executive' },
  { id: 'healthcare', name: 'Healthcare', description: 'Patient recovery, clinical operations, capacity and patient experience.', icon: 'healthcare' },
  { id: 'education', name: 'Education & Learning', description: 'Courses, students, enrolments and learning engagement.', icon: 'education' },
  { id: 'fitness', name: 'Fitness & Wellness', description: 'Activity, workouts, sleep, heart rate and nutrition.', icon: 'fitness' },
];
