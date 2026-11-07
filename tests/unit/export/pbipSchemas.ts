/**
 * Validates generated PBIR files against Microsoft's published JSON schemas
 * (vendored in tests/fixtures/pbir-schemas from github.com/microsoft/json-schemas).
 */
import Ajv, { type ValidateFunction } from 'ajv';

const SCHEMAS = import.meta.glob<Record<string, unknown>>('../../fixtures/pbir-schemas/*.json', { eager: true, import: 'default' });
const BASE = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition';

/**
 * The "embedded" schemas declare `schema.embedded.json` as their $id while
 * other schemas reference them as `schema-embedded.json`; register them under
 * the referenced URL so references resolve.
 */
const ID_OVERRIDES: Record<string, string> = {
  'filterConfiguration-1.2.0-embedded.json': `${BASE}/filterConfiguration/1.2.0/schema-embedded.json`,
  'visualConfiguration-2.1.0-embedded.json': `${BASE}/visualConfiguration/2.1.0/schema-embedded.json`,
};

let ajv: Ajv | undefined;

function instance(): Ajv {
  if (ajv) return ajv;
  ajv = new Ajv({ strict: false, allErrors: true });
  for (const [path, loaded] of Object.entries(SCHEMAS)) {
    const file = path.split('/').pop()!;
    const schema = structuredClone(loaded);
    if (ID_OVERRIDES[file]) schema.$id = ID_OVERRIDES[file];
    ajv.addSchema(schema);
  }
  return ajv;
}

const cache = new Map<string, ValidateFunction>();

/** Validates a generated JSON document against the schema named in its `$schema`. Returns error messages. */
export function validateAgainstOwnSchema(content: unknown): string[] {
  const schemaUrl = (content as { $schema?: string }).$schema;
  if (!schemaUrl) return ['missing $schema'];
  let validate = cache.get(schemaUrl);
  if (!validate) {
    validate = instance().getSchema(schemaUrl);
    if (!validate) return [`schema not vendored: ${schemaUrl}`];
    cache.set(schemaUrl, validate);
  }
  if (validate(content)) return [];
  return (validate.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || '/'} ${e.message ?? ''} ${JSON.stringify(e.params)}`);
}
