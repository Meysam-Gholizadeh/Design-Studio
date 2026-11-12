/**
 * Naming and quoting rules for the generated Power BI project:
 * semantic-model object names (tables, columns, measures), TMDL / DAX / M
 * quoting, PBIR object names and file-system folder names.
 */

const UNSAFE_MODEL_CHARS = /[^\p{L}\p{N} _\-%&$()#+/]/gu;

/** A readable model object name: no quotes, brackets, dots or control characters. */
export function cleanModelName(raw: string | undefined, fallback: string): string {
  const s = (raw ?? '').replace(UNSAFE_MODEL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim();
  return s || fallback;
}

/** Case-insensitive name registry (the tabular model compares names case-insensitively). */
export class NameRegistry {
  private readonly used = new Set<string>();

  has(name: string): boolean {
    return this.used.has(name.toLowerCase());
  }

  add(name: string): void {
    this.used.add(name.toLowerCase());
  }

  /** Claims the first free candidate, then numbered variants of the first one. */
  claim(candidates: string[], isTaken: (name: string) => boolean = () => false): string {
    const free = (n: string) => !this.has(n) && !isTaken(n);
    let name = candidates.find(free);
    for (let i = 2; !name; i++) {
      const n = `${candidates[0]} ${i}`;
      if (free(n)) name = n;
    }
    this.add(name);
    return name;
  }
}

/** TMDL object name: quoted unless it is a plain identifier. */
export function tmdlName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

/**
 * TMDL text property value. Values are written verbatim unless they start or
 * end with a double quote or whitespace, in which case they are enclosed in
 * double quotes with inner quotes doubled.
 */
export function tmdlText(value: string): string {
  return /^["\s]|["\s]$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const dax = {
  table: (name: string) => `'${name.replace(/'/g, "''")}'`,
  column: (table: string, column: string) => `${dax.table(table)}[${column.replace(/]/g, ']]')}]`,
  measure: (name: string) => `[${name.replace(/]/g, ']]')}]`,
};

export const m = {
  /** Quoted identifier, valid for any name: #"Sort Order". */
  identifier: (name: string) => `#"${name.replace(/"/g, '""')}"`,
  /**
   * Text literal valid for any content: quotes are doubled, "#(" (the start of
   * an M escape sequence) becomes "#(#)(" and line breaks / tabs use escapes,
   * so the literal stays on one line.
   */
  string: (s: string) =>
    `"${s
      .replace(/"/g, '""')
      .replace(/#\(/g, '#(#)(')
      .replace(/\r/g, '#(cr)')
      .replace(/\n/g, '#(lf)')
      .replace(/\t/g, '#(tab)')}"`,
};

/**
 * Project name used for the folder and file names; valid on Windows, macOS and
 * Linux, with spaces kept for readability. It is kept short because it appears
 * three times in every path and Windows limits paths to 260 characters.
 */
export const MAX_PROJECT_NAME = 30;

export function projectFolderName(name: string): string {
  const s = name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROJECT_NAME)
    .trim()
    .replace(/[. ]+$/, '');
  if (!s || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) return 'Dashboard';
  return s;
}

/** 32-bit FNV-1a hash. */
function fnv1a(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic 20-character hex object name, the form Power BI Desktop uses
 * for pages and visuals (e.g. "90c2e07d8e84e7d5c026").
 */
export function pbirObjectName(seed: string, taken?: Set<string>): string {
  for (let attempt = 0; ; attempt++) {
    const s = attempt ? `${seed}#${attempt}` : seed;
    const name = [0x811c9dc5, 0x01000193, 0x9e3779b9]
      .map((k) => fnv1a(s, k).toString(16).padStart(8, '0'))
      .join('')
      .slice(0, 20);
    if (!taken?.has(name)) {
      taken?.add(name);
      return name;
    }
  }
}
