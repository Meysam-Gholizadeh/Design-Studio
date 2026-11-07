/**
 * The design-plan schema as a plain, fully inlined JSON Schema, restricted to
 * keywords every provider's structured output accepts (no `const`, no `$ref`,
 * no numeric bounds). Used for Gemini's `responseJsonSchema`.
 */
import { z } from 'zod';
import { designPlanSchema } from './designPlan';

const KEEP = new Set(['type', 'description', 'enum', 'items', 'properties', 'required', 'additionalProperties', 'anyOf']);

type Json = { [key: string]: unknown };

function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (!node || typeof node !== 'object') return node;
  const src = node as Json;
  const out: Json = {};
  for (const [key, value] of Object.entries(src)) {
    if (key === 'const') {
      out.enum = [value];
      if (typeof value === 'string') out.type = 'string';
    } else if (key === 'properties') {
      out.properties = Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, clean(v)]));
    } else if (KEEP.has(key)) {
      out[key] = clean(value);
    }
  }
  return out;
}

let cached: Json | null = null;

export function planJsonSchema(): Json {
  cached ??= clean(z.toJSONSchema(designPlanSchema, { reused: 'inline', unrepresentable: 'any' })) as Json;
  return cached;
}

/**
 * Strict variant for OpenAI structured outputs: every object lists all its
 * properties as required and forbids extra ones. The plan has no optional
 * fields, so this does not change what a valid plan is.
 */
function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== 'object') return node;
  const out: Json = {};
  for (const [key, value] of Object.entries(node as Json)) {
    out[key] = key === 'properties' ? Object.fromEntries(Object.entries(value as Json).map(([k, v]) => [k, strictify(v)])) : strictify(value);
  }
  if (out.properties && typeof out.properties === 'object') {
    out.required = Object.keys(out.properties as Json);
    out.additionalProperties = false;
  }
  return out;
}

let strictCached: Json | null = null;

export function strictPlanJsonSchema(): Json {
  strictCached ??= strictify(planJsonSchema()) as Json;
  return strictCached;
}
