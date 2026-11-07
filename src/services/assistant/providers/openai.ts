/**
 * OpenAI provider. Browser → OpenAI Responses API with the user's own key,
 * streamed, strict structured output from the design-plan JSON Schema.
 * Responses are not stored on OpenAI (`store: false`); the conversation is
 * resent from this browser each turn.
 */
import OpenAI from 'openai';
import type { Response, ResponseInputContent, ResponseInputItem } from 'openai/resources/responses/responses';
import { attachmentAsText, type Attachment } from '../attachments';
import { strictPlanJsonSchema } from '../planJsonSchema';
import { SYSTEM_PROMPT } from '../systemPrompt';
import { AssistantError, parsePlanText, type AssistantProvider, type DesignRequest, type DesignTurn } from '../types';

type Message = ResponseInputItem.Message | { role: 'assistant'; content: string };

export function describeOpenAIError(err: unknown): AssistantError {
  if (err instanceof AssistantError) return err;
  if (err instanceof OpenAI.APIUserAbortError) return new AssistantError('Stopped.');
  if (err instanceof OpenAI.AuthenticationError) return new AssistantError('The OpenAI API key was not accepted. Check it in the key settings and try again.');
  if (err instanceof OpenAI.PermissionDeniedError) return new AssistantError('This key is not allowed to use the model. Check your OpenAI project and key permissions.');
  if (err instanceof OpenAI.NotFoundError) return new AssistantError('This OpenAI model is not available for your key. Choose another model.');
  if (err instanceof OpenAI.RateLimitError) {
    const quota = err.code === 'insufficient_quota' || /quota|billing/i.test(err.message);
    return quota
      ? new AssistantError('Your OpenAI account has no quota left. Check billing in the OpenAI dashboard and try again.')
      : new AssistantError('The OpenAI API rate limit was reached. Wait a moment and try again.', true);
  }
  if (err instanceof OpenAI.BadRequestError) return new AssistantError(`The request was rejected: ${err.message.slice(0, 300)}`);
  if (err instanceof OpenAI.APIConnectionError) return new AssistantError('Could not reach the OpenAI API. Check your internet connection and try again.', true);
  if (err instanceof OpenAI.APIError && (err.status ?? 0) >= 500) {
    return new AssistantError('The OpenAI API is busy or unavailable right now. Try again in a minute.', true);
  }
  if (err instanceof OpenAI.APIError) return new AssistantError(`The OpenAI API returned an error${err.status ? ` (${err.status})` : ''}: ${err.message.slice(0, 300)}`);
  return new AssistantError(err instanceof Error ? err.message : 'Something went wrong while contacting the assistant.');
}

/** Check how a finished response ended and read the plan from its text. */
export function readOpenAIAnswer(response: Pick<Response, 'status' | 'incomplete_details' | 'output'>) {
  const parts = response.output.flatMap((item) => (item.type === 'message' ? item.content : []));
  if (parts.some((p) => p.type === 'refusal') || response.incomplete_details?.reason === 'content_filter') {
    throw new AssistantError('OpenAI declined this request. Rephrase the brief as a business dashboard and try again.');
  }
  if (response.status === 'incomplete') {
    throw new AssistantError('The design was too large to finish. Ask for fewer pages or visuals and try again.');
  }
  const text = parts.map((p) => (p.type === 'output_text' ? p.text : '')).join('');
  return { plan: parsePlanText(text), text };
}

async function requestDesign({ apiKey, model, history, signal, onProgress }: DesignRequest): Promise<DesignTurn> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  try {
    const stream = client.responses.stream(
      {
        model,
        instructions: SYSTEM_PROMPT,
        input: history as ResponseInputItem[],
        store: false,
        reasoning: { effort: 'medium' },
        max_output_tokens: 64000,
        text: { format: { type: 'json_schema', name: 'design_plan', schema: strictPlanJsonSchema(), strict: true } },
      },
      { signal },
    );
    let written = 0;
    onProgress?.({ phase: 'thinking', written });
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        written += event.delta.length;
        onProgress?.({ phase: 'writing', written });
      }
    }
    if (signal?.aborted) throw new AssistantError('Stopped.');
    const response = await stream.finalResponse();
    const { plan, text } = readOpenAIAnswer(response);
    const nativeMessage: Message = { role: 'assistant', content: text };
    return { plan, nativeMessage, rawText: text, model: response.model };
  } catch (err) {
    throw describeOpenAIError(err);
  }
}

/** Files first (images and PDFs as data URLs, other files as text), then the user's text. */
function userMessage(text: string, attachments: Attachment[] = []): Message {
  const files: ResponseInputContent[] = attachments.map((a) =>
    a.kind === 'image'
      ? { type: 'input_image', image_url: `data:${a.mediaType};base64,${a.data}`, detail: 'auto' }
      : a.kind === 'pdf'
        ? { type: 'input_file', filename: a.name, file_data: `data:application/pdf;base64,${a.data}` }
        : { type: 'input_text', text: attachmentAsText(a) },
  );
  return { role: 'user', content: [...files, { type: 'input_text', text }] };
}

export const openaiProvider: AssistantProvider = {
  id: 'openai',
  label: 'OpenAI',
  keyUrl: 'https://platform.openai.com/api-keys',
  keyUrlLabel: 'OpenAI dashboard',
  keyPlaceholder: 'sk-…',
  keyHint: 'OpenAI API keys start with "sk-" (project keys with "sk-proj-").',
  looksLikeKey: (value) => /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/.test(value.trim()),
  models: [
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', note: 'Recommended: balanced quality and speed' },
    { id: 'gpt-6-astra', label: 'GPT-6 Astra', note: 'Most capable, slower' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna', note: 'Fastest and lowest cost' },
  ],
  defaultModel: 'gpt-6.1-sol',
  userMessage,
  fromTranscript: (turns) => turns.map((t): Message => (t.role === 'user' ? userMessage(t.text, t.attachments) : { role: 'assistant', content: t.text })),
  requestDesign,
};
