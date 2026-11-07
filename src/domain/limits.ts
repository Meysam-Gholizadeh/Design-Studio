/**
 * Hard limits applied to every dashboard document, whether it was created in
 * the editor or imported from an untrusted JSON file.
 */
export const LIMITS = {
  /** Maximum JSON payload accepted on import, in bytes. */
  maxImportBytes: 2 * 1024 * 1024,
  maxPages: 20,
  maxComponentsPerPage: 100,
  maxIdLength: 80,
  maxNameLength: 120,
  maxTitleLength: 160,
  maxDescriptionLength: 1000,
  maxTextLength: 4000,
  maxLabelLength: 120,
  maxCategories: 60,
  maxSeries: 12,
  maxSlices: 24,
  maxTableColumns: 16,
  maxTableRows: 200,
  maxSlicerOptions: 60,
  maxSparklinePoints: 60,
  /** Images are stored inline as data URLs; keep them small. */
  maxImageDataUrlLength: 700_000,
  gridColumnsMin: 4,
  gridColumnsMax: 24,
  canvasMinWidth: 640,
  canvasMaxWidth: 3840,
  canvasMinHeight: 400,
  canvasMaxHeight: 4000,
} as const;

export const SCHEMA_VERSION = '1.0' as const;
export const SUPPORTED_SCHEMA_MAJOR = 1;
