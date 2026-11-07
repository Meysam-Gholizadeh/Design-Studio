import { z } from 'zod';
import { idSchema, labelSchema, nameSchema } from './primitives';
import { dashboardDocumentSchema } from './document';

export const CATEGORY_IDS = ['finance', 'operations', 'hr', 'sales-marketing', 'procurement', 'executive', 'healthcare', 'education', 'fitness'] as const;

export const categorySchema = z.object({
  id: idSchema,
  name: nameSchema,
  description: z.string().max(300),
  /** Icon key resolved to an icon component by the UI layer. */
  icon: z.string().max(40),
});
export type Category = z.infer<typeof categorySchema>;

export const LAYOUT_PRESET_IDS = ['executive-overview', 'sidebar-navigation', 'data-dense', 'storytelling'] as const;

export const templateDefinitionSchema = z.object({
  id: idSchema,
  name: nameSchema,
  categoryId: idSchema,
  description: z.string().max(400),
  audience: z.string().max(200),
  purpose: z.string().max(400),
  kpis: z.array(labelSchema).min(1).max(16),
  /** Extra search keywords. */
  tags: z.array(labelSchema).max(16),
  themeId: idSchema,
  layoutPresetId: z.enum(LAYOUT_PRESET_IDS),
  featured: z.boolean().optional(),
  document: dashboardDocumentSchema,
});
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;
