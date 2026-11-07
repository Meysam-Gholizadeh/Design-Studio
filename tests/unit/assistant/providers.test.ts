import { describe, expect, it } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { ApiError, FinishReason } from '@google/genai';
import OpenAI from 'openai';
import { planJsonSchema, strictPlanJsonSchema } from '@/services/assistant/planJsonSchema';
import { describeOpenAIError, openaiProvider, readOpenAIAnswer } from '@/services/assistant/providers/openai';
import { anthropicProvider, describeAnthropicError, readAnthropicPlan } from '@/services/assistant/providers/anthropic';
import { describeGeminiError, geminiProvider, readGeminiAnswer } from '@/services/assistant/providers/gemini';
import { AssistantError, parsePlanText } from '@/services/assistant/types';

const validPlan = {
  kind: 'message',
  reply: 'I can only design dashboards.',
  name: 'x',
  description: '',
  themeId: 'corporate-blue',
  categoryId: 'other',
  pages: [],
};
const json = JSON.stringify(validPlan);

describe('parsePlanText', () => {
  it('accepts a valid plan and explains malformed ones', () => {
    expect(parsePlanText(json).reply).toBe('I can only design dashboards.');
    expect(() => parsePlanText('not json')).toThrow(/unreadable/);
    expect(() => parsePlanText(JSON.stringify({ ...validPlan, themeId: 'pink' }))).toThrow(/unexpected format/);
  });
});

describe('Anthropic provider', () => {
  function message(text: string, stop_reason: Anthropic.Beta.BetaMessage['stop_reason'] = 'end_turn'): Anthropic.Beta.BetaMessage {
    return {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        { type: 'text', text, citations: null },
      ],
      stop_reason,
      stop_sequence: null,
    } as unknown as Anthropic.Beta.BetaMessage;
  }

  it('reads the plan from the text block and explains refusals and truncation', () => {
    expect(readAnthropicPlan(message(json)).plan.kind).toBe('message');
    expect(() => readAnthropicPlan(message('', 'refusal'))).toThrow(/declined/);
    expect(() => readAnthropicPlan(message('{"kind":', 'max_tokens'))).toThrow(/too large/);
  });

  it('turns API errors into user-facing messages', () => {
    const headers = new Headers();
    expect(describeAnthropicError(new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key', headers)).message).toMatch(/API key was not accepted/);
    expect(describeAnthropicError(new Anthropic.RateLimitError(429, undefined, 'rate limited', headers)).retryable).toBe(true);
    expect(describeAnthropicError(new Anthropic.BadRequestError(400, undefined, 'Your credit balance is too low', headers)).message).toMatch(/no credit/);
    expect(describeAnthropicError(new Anthropic.InternalServerError(529, undefined, 'overloaded', headers)).message).toMatch(/busy/);
    expect(describeAnthropicError(new Anthropic.APIConnectionError({ message: 'fetch failed' })).message).toMatch(/internet/);
    const own = new AssistantError('custom');
    expect(describeAnthropicError(own)).toBe(own);
  });

  it('checks key format and rebuilds history from a transcript', () => {
    expect(anthropicProvider.looksLikeKey(`sk-ant-${'a'.repeat(30)}`)).toBe(true);
    expect(anthropicProvider.looksLikeKey('AIzaSyD-not-anthropic-key-0000000000')).toBe(false);
    expect(anthropicProvider.fromTranscript([{ role: 'user', text: 'hi' }, { role: 'assistant', text: json }])).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: json },
    ]);
  });
});

describe('Gemini provider', () => {
  it('reads the answer and explains blocked or truncated answers', () => {
    expect(readGeminiAnswer(json, FinishReason.STOP, undefined).kind).toBe('message');
    expect(() => readGeminiAnswer('', FinishReason.SAFETY, undefined)).toThrow(/declined/);
    expect(() => readGeminiAnswer('', undefined, 'PROHIBITED_CONTENT')).toThrow(/declined/);
    expect(() => readGeminiAnswer('{"kind":', FinishReason.MAX_TOKENS, undefined)).toThrow(/too large/);
  });

  it('turns API errors into user-facing messages', () => {
    expect(describeGeminiError(new ApiError({ status: 400, message: 'API key not valid. Please pass a valid API key.' })).message).toMatch(/Gemini API key was not accepted/);
    expect(describeGeminiError(new ApiError({ status: 404, message: 'models/x is not found' })).message).toMatch(/not available/);
    expect(describeGeminiError(new ApiError({ status: 429, message: 'Resource exhausted' })).retryable).toBe(true);
    expect(describeGeminiError(new ApiError({ status: 503, message: 'overloaded' })).message).toMatch(/busy/);
    expect(describeGeminiError(new TypeError('Failed to fetch')).message).toMatch(/internet/);
  });

  it('checks key format and uses the "model" role in history', () => {
    expect(geminiProvider.looksLikeKey('AIzaSyD4k3y-abcdefghijklmnopqrstuvwx')).toBe(true);
    expect(geminiProvider.looksLikeKey('short')).toBe(false);
    expect(geminiProvider.fromTranscript([{ role: 'user', text: 'hi' }, { role: 'assistant', text: json }])).toEqual([
      { role: 'user', parts: [{ text: 'hi' }] },
      { role: 'model', parts: [{ text: json }] },
    ]);
  });
});

describe('OpenAI provider', () => {
  type Answer = Parameters<typeof readOpenAIAnswer>[0];
  const answer = (content: object[], status = 'completed', reason?: string): Answer =>
    ({
      status,
      incomplete_details: reason ? { reason } : null,
      output: [
        { type: 'reasoning', id: 'rs_1', summary: [] },
        { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content },
      ],
    }) as unknown as Answer;

  it('reads the plan from output text and explains refusals and truncation', () => {
    expect(readOpenAIAnswer(answer([{ type: 'output_text', text: json, annotations: [] }])).plan.kind).toBe('message');
    expect(() => readOpenAIAnswer(answer([{ type: 'refusal', refusal: 'no' }]))).toThrow(/declined/);
    expect(() => readOpenAIAnswer(answer([], 'incomplete', 'content_filter'))).toThrow(/declined/);
    expect(() => readOpenAIAnswer(answer([{ type: 'output_text', text: '{"kind":', annotations: [] }], 'incomplete', 'max_output_tokens'))).toThrow(/too large/);
  });

  it('turns API errors into user-facing messages', () => {
    const headers = new Headers();
    expect(describeOpenAIError(new OpenAI.AuthenticationError(401, undefined, 'Incorrect API key', headers)).message).toMatch(/OpenAI API key was not accepted/);
    expect(describeOpenAIError(new OpenAI.RateLimitError(429, { code: 'insufficient_quota' }, 'You exceeded your current quota', headers)).message).toMatch(/no quota/);
    expect(describeOpenAIError(new OpenAI.RateLimitError(429, undefined, 'Rate limit reached', headers)).retryable).toBe(true);
    expect(describeOpenAIError(new OpenAI.NotFoundError(404, undefined, 'model not found', headers)).message).toMatch(/not available/);
    expect(describeOpenAIError(new OpenAI.InternalServerError(503, undefined, 'overloaded', headers)).message).toMatch(/busy/);
    expect(describeOpenAIError(new OpenAI.APIConnectionError({ message: 'fetch failed' })).message).toMatch(/internet/);
  });

  it('checks key format (not Anthropic keys) and rebuilds history from a transcript', () => {
    expect(openaiProvider.looksLikeKey(`sk-proj-${'a'.repeat(40)}`)).toBe(true);
    expect(openaiProvider.looksLikeKey(`sk-ant-${'a'.repeat(30)}`)).toBe(false);
    expect(openaiProvider.looksLikeKey('AIzaSyD4k3y-abcdefghijklmnopqrstuvwx')).toBe(false);
    expect(openaiProvider.fromTranscript([{ role: 'user', text: 'hi' }, { role: 'assistant', text: json }])).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
      { role: 'assistant', content: json },
    ]);
  });
});

describe('strictPlanJsonSchema (OpenAI strict structured outputs)', () => {
  it('requires every property and forbids extra ones on every object', () => {
    const objects: { properties: Record<string, unknown>; required: string[]; additionalProperties: unknown }[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      if (n.properties) objects.push(n as never);
      Object.values(n).forEach(walk);
    };
    walk(strictPlanJsonSchema());
    expect(objects.length).toBeGreaterThan(10);
    for (const o of objects) {
      expect(o.required.sort()).toEqual(Object.keys(o.properties).sort());
      expect(o.additionalProperties).toBe(false);
    }
    expect(JSON.stringify(strictPlanJsonSchema())).not.toContain('"$ref"');
  });
});

describe('planJsonSchema (Gemini responseJsonSchema)', () => {
  it('is inlined and uses only widely supported keywords', () => {
    const text = JSON.stringify(planJsonSchema());
    for (const keyword of ['"$ref"', '"$defs"', '"const"', '"minimum"', '"maximum"', '"$schema"', '"oneOf"']) expect(text).not.toContain(keyword);
    const schema = planJsonSchema() as { properties: Record<string, unknown>; required: string[] };
    expect(schema.required).toEqual(expect.arrayContaining(['kind', 'reply', 'pages', 'themeId']));
    // Literal visual types become one-value enums.
    expect(text).toContain('"enum":["kpi"]');
  });
});
