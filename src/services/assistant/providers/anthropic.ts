/**
 * Anthropic Claude provider. Browser → Anthropic API with the user's own key,
 * streamed, structured output from the design-plan schema, refusal fallback.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { Attachment } from '../attachments';
import { designPlanSchema, type DesignPlan } from '../designPlan';
import { SYSTEM_PROMPT } from '../systemPrompt';
import { AssistantError, lastLine, parsePlanText, type AssistantProvider, type DesignRequest, type DesignTurn } from '../types';

type Message = Anthropic.Beta.BetaMessageParam;

const outputFormat = betaZodOutputFormat(designPlanSchema);

export function describeAnthropicError(err: unknown): AssistantError {
  if (err instanceof AssistantError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new AssistantError('Stopped.');
  if (err instanceof Anthropic.AuthenticationError) return new AssistantError('The API key was not accepted. Check it in the key settings and try again.');
  if (err instanceof Anthropic.PermissionDeniedError) return new AssistantError('This API key is not allowed to use the model. Check your Anthropic account and key permissions.');
  if (err instanceof Anthropic.NotFoundError) return new AssistantError('This model is not available for your key. Choose another model.');
  if (err instanceof Anthropic.RateLimitError) return new AssistantError('The Anthropic API rate limit was reached. Wait a moment and try again.', true);
  if (err instanceof Anthropic.BadRequestError) {
    const credit = /credit|billing|balance/i.test(err.message);
    return new AssistantError(credit ? 'Your Anthropic account has no credit left. Add credit in the Anthropic Console and try again.' : `The request was rejected: ${err.message}`);
  }
  if (err instanceof Anthropic.APIConnectionError) return new AssistantError('Could not reach the Anthropic API. Check your internet connection and try again.', true);
  if (err instanceof Anthropic.APIError && (err.status === 529 || (err.status ?? 0) >= 500)) {
    return new AssistantError('The Anthropic API is busy or unavailable right now. Try again in a minute.', true);
  }
  if (err instanceof Anthropic.APIError) return new AssistantError(`The Anthropic API returned an error${err.status ? ` (${err.status})` : ''}: ${err.message}`);
  return new AssistantError(err instanceof Error ? err.message : 'Something went wrong while contacting the assistant.');
}

/** Read the design plan out of a finished response. */
export function readAnthropicPlan(message: Anthropic.Beta.BetaMessage): { plan: DesignPlan; text: string } {
  if (message.stop_reason === 'refusal') {
    throw new AssistantError('The assistant declined this request. Rephrase the brief as a business dashboard and try again.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new AssistantError('The design was too large to finish. Ask for fewer pages or visuals and try again.');
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return { plan: parsePlanText(text), text };
}

async function requestDesign({ apiKey, model, history, signal, onProgress }: DesignRequest): Promise<DesignTurn> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        // If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
        fallbacks: 'default',
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort: 'medium', format: outputFormat },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: history as Message[],
      },
      { signal },
    );
    let written = 0;
    let note: string | undefined;
    stream.on('thinking', (_delta, snapshot) => {
      note = lastLine(snapshot) ?? note;
      onProgress?.({ phase: 'thinking', note, written });
    });
    stream.on('text', (delta) => {
      written += delta.length;
      onProgress?.({ phase: 'writing', note, written });
    });
    const message = await stream.finalMessage();
    const { plan, text } = readAnthropicPlan(message);
    const nativeMessage: Message = { role: 'assistant', content: message.content as Anthropic.Beta.BetaContentBlockParam[] };
    return { plan, nativeMessage, rawText: text, model: message.model };
  } catch (err) {
    throw describeAnthropicError(err);
  }
}

/** Files first (images, PDFs and text as document blocks), then the user's text. */
function userMessage(text: string, attachments: Attachment[] = []): Message {
  if (attachments.length === 0) return { role: 'user', content: text };
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = attachments.map((a) =>
    a.kind === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.data } }
      : a.kind === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data }, title: a.name }
        : {
            type: 'document',
            source: { type: 'text', media_type: 'text/plain', data: a.text },
            title: a.name,
            ...(a.truncated ? { context: 'Only the beginning of this file is included.' } : {}),
          },
  );
  return { role: 'user', content: [...blocks, { type: 'text', text }] };
}

export const anthropicProvider: AssistantProvider = {
  id: 'anthropic',
  label: 'Anthropic Claude',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  keyUrlLabel: 'Anthropic Console',
  keyPlaceholder: 'sk-ant-…',
  keyHint: 'Anthropic API keys start with "sk-ant-".',
  looksLikeKey: (value) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim()),
  models: [{ id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Most capable' }],
  defaultModel: 'claude-opus-5-5',
  userMessage,
  fromTranscript: (turns) => turns.map((t): Message => (t.role === 'user' ? userMessage(t.text, t.attachments) : { role: 'assistant', content: t.text })),
  requestDesign,
};
