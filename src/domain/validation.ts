import type { z } from 'zod';
import { LIMITS, SUPPORTED_SCHEMA_MAJOR } from './limits';
import { dashboardDocumentSchema, type DashboardDocument } from './schemas/document';

export interface ValidationIssue {
  /** Human-readable location, e.g. "pages[0].components[3].layout". */
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

const MAX_REPORTED_ISSUES = 8;

export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    const k = String(key);
    return acc ? `${acc}.${k}` : k;
  }, '');
}

function toIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
    path: formatPath(issue.path) || '(document)',
    message: issue.message,
  }));
}

/**
 * Validate an unknown value as a DashboardDocument. Checks the schema major
 * version first so an unsupported file gets a clear, single message instead of
 * a cascade of field errors.
 */
export function validateDashboardDocument(input: unknown): ValidationResult<DashboardDocument> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, issues: [{ path: '(document)', message: 'Expected a dashboard document object' }] };
  }

  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'string') {
    return {
      ok: false,
      issues: [{ path: 'schemaVersion', message: 'Missing schemaVersion — this does not look like a BI Design Studio file' }],
    };
  }
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (major !== SUPPORTED_SCHEMA_MAJOR) {
    return {
      ok: false,
      issues: [
        {
          path: 'schemaVersion',
          message: `Schema version "${version.slice(0, 20)}" is not supported. This version of BI Design Studio reads version ${SUPPORTED_SCHEMA_MAJOR}.x files.`,
        },
      ],
    };
  }

  const result = dashboardDocumentSchema.safeParse(input);
  if (!result.success) return { ok: false, issues: toIssues(result.error) };
  return { ok: true, value: result.data };
}

/** Parse JSON text with a size guard, then validate it. */
export function parseDashboardJson(text: string): ValidationResult<DashboardDocument> {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > LIMITS.maxImportBytes) {
    return {
      ok: false,
      issues: [{ path: '(file)', message: `File is too large (${Math.round(bytes / 1024)} KB). The maximum is ${LIMITS.maxImportBytes / 1024 / 1024} MB.` }],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, issues: [{ path: '(file)', message: 'The file is not valid JSON.' }] };
  }
  return validateDashboardDocument(parsed);
}
