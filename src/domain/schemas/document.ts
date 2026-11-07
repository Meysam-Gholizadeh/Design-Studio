import { z } from 'zod';
import { LIMITS, SCHEMA_VERSION } from '../limits';
import { maxRowsForHeight, rectsOverlap } from '../grid';
import { colorSchema, idSchema, isoDateSchema, nameSchema } from './primitives';
import { dashboardComponentSchema } from './visuals';
import { themeOverridesSchema } from './theme';

export const gridSettingsSchema = z.object({
  columns: z.number().int().min(LIMITS.gridColumnsMin).max(LIMITS.gridColumnsMax),
  rowHeight: z.number().int().min(8).max(120),
  margin: z.tuple([z.number().int().min(0).max(48), z.number().int().min(0).max(48)]),
  preventCollision: z.boolean(),
});
export type GridSettings = z.infer<typeof gridSettingsSchema>;

/**
 * Page size and background. Grid settings live on each page (single source of
 * truth); `background` is an optional override of the theme's page background.
 */
export const canvasSettingsSchema = z.object({
  width: z.number().int().min(LIMITS.canvasMinWidth).max(LIMITS.canvasMaxWidth),
  height: z.number().int().min(LIMITS.canvasMinHeight).max(LIMITS.canvasMaxHeight),
  background: colorSchema.optional(),
  breakpointMode: z.enum(['responsive', 'fixed']),
});
export type CanvasSettings = z.infer<typeof canvasSettingsSchema>;

export const dashboardPageSchema = z.object({
  id: idSchema,
  name: nameSchema,
  grid: gridSettingsSchema,
  components: z
    .array(dashboardComponentSchema)
    .max(LIMITS.maxComponentsPerPage, `A page can contain at most ${LIMITS.maxComponentsPerPage} visuals`),
});
export type DashboardPage = z.infer<typeof dashboardPageSchema>;

/**
 * Where a design came from, when it was not built in the studio.
 * - `html-import`: values were copied from the user's file (not fictional
 *   sample data), and notices say so.
 * - `ai-assistant`: drafted by the AI assistant; values are fictional sample data.
 */
export const designSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('html-import'),
    fileName: z.string().max(200),
    importedAt: isoDateSchema,
  }),
  z.object({
    kind: z.literal('ai-assistant'),
    model: z.string().max(80),
    generatedAt: isoDateSchema,
  }),
]);
export type DesignSource = z.infer<typeof designSourceSchema>;

/** Accepts any 1.x version string; major-version checks happen before parsing. */
const schemaVersionSchema = z.string().regex(/^1\.\d+$/, `Unsupported schema version (expected ${SCHEMA_VERSION})`);

export const dashboardDocumentSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    id: idSchema,
    name: nameSchema,
    description: z.string().max(LIMITS.maxDescriptionLength).optional(),
    categoryId: idSchema.optional(),
    sourceTemplateId: idSchema.optional(),
    source: designSourceSchema.optional(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
    themeId: idSchema,
    themeOverrides: themeOverridesSchema.optional(),
    canvas: canvasSettingsSchema,
    pages: z
      .array(dashboardPageSchema)
      .min(1, 'A dashboard needs at least one page')
      .max(LIMITS.maxPages, `A dashboard can contain at most ${LIMITS.maxPages} pages`),
  })
  .check((ctx) => {
    const doc = ctx.value;
    const seen = new Set<string>([doc.id]);
    const flagDuplicate = (id: string, path: (string | number)[]) => {
      if (seen.has(id)) ctx.issues.push({ code: 'custom', message: `Duplicate ID "${id}"`, input: id, path });
      seen.add(id);
    };

    doc.pages.forEach((page, p) => {
      flagDuplicate(page.id, ['pages', p, 'id']);
      const maxRows = maxRowsForHeight(doc.canvas.height, page.grid);
      page.components.forEach((c, i) => {
        const path = ['pages', p, 'components', i];
        flagDuplicate(c.id, [...path, 'id']);
        const { x, y, w, h } = c.layout;
        if (x + w > page.grid.columns) {
          ctx.issues.push({ code: 'custom', message: `"${c.title ?? c.id}" extends past the ${page.grid.columns}-column grid`, input: c.layout, path: [...path, 'layout'] });
        }
        if (y + h > maxRows) {
          ctx.issues.push({ code: 'custom', message: `"${c.title ?? c.id}" extends below the page (max ${maxRows} rows)`, input: c.layout, path: [...path, 'layout'] });
        }
      });
      if (page.grid.preventCollision) {
        const comps = page.components;
        for (let a = 0; a < comps.length; a++) {
          for (let b = a + 1; b < comps.length; b++) {
            if (rectsOverlap(comps[a]!.layout, comps[b]!.layout)) {
              ctx.issues.push({
                code: 'custom',
                message: `Visuals "${comps[a]!.id}" and "${comps[b]!.id}" overlap on page "${page.name}"`,
                input: comps[b]!.layout,
                path: ['pages', p, 'components', b, 'layout'],
              });
            }
          }
        }
      }
    });
  });

export type DashboardDocument = z.infer<typeof dashboardDocumentSchema>;
