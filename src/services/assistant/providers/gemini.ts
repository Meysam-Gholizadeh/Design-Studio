/**
 * Google Gemini provider. Browser → Gemini API with the user's own key,
 * streamed, JSON output constrained by the design-plan JSON Schema, with
 * thought summaries shown as progress.
 */
import { ApiError, FinishReason, GoogleGenAI, type Content, type GenerateContentResponse, type Part } from '@google/genai';
import { attachmentAsText, type Attachment } from '../attachments';
import { planJsonSchema } from '../planJsonSchema';
import { SYSTEM_PROMPT } from '../systemPrompt';
import { AssistantError, lastLine, parsePlanText, type AssistantProvider, type DesignRequest, type DesignTurn } from '../types';

export function describeGeminiError(err: unknown): AssistantError {
  if (err instanceof AssistantError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') return new AssistantError('Stopped.');
  if (err instanceof ApiError) {
    const msg = err.message;
    if (/api[_ ]key/i.test(msg) && (err.status === 400 || err.status === 401 || err.status === 403)) {
      return new AssistantError('The Gemini API key was not accepted. Check it in the key settings and try again.');
    }
    if (err.status === 403) return new AssistantError('This key is not allowed to use the Gemini API. Check the key’s restrictions in Google AI Studio.');
    if (err.status === 404) return new AssistantError('This Gemini model is not available for your key. Choose another model.');
    if (err.status === 429) return new AssistantError('The Gemini API quota or rate limit was reached. Wait a moment, or check your quota in Google AI Studio.', true);
    if (err.status >= 500) return new AssistantError('The Gemini API is busy or unavailable right now. Try again in a minute.', true);
    return new AssistantError(`The Gemini API returned an error (${err.status}): ${msg.slice(0, 300)}`);
  }
  if (err instanceof TypeError) return new AssistantError('Could not reach the Gemini API. Check your internet connection and try again.', true);
  return new AssistantError(err instanceof Error ? err.message : 'Something went wrong while contacting the assistant.');
}

const BLOCKED = new Set<string>([FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.SPII, FinishReason.RECITATION]);

/** Check how a streamed answer ended and read the plan from its text. */
export function readGeminiAnswer(text: string, finishReason: string | undefined, blockReason: string | undefined) {
  if (blockReason || (finishReason && BLOCKED.has(finishReason))) {
    throw new AssistantError('Gemini declined this request. Rephrase the brief as a business dashboard and try again.');
  }
  if (finishReason === FinishReason.MAX_TOKENS) {
    throw new AssistantError('The design was too large to finish. Ask for fewer pages or visuals and try again.');
  }
  return parsePlanText(text);
}

async function requestDesign({ apiKey, model, history, signal, onProgress }: DesignRequest): Promise<DesignTurn> {
  const ai = new GoogleGenAI({ apiKey });
  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: history as Content[],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: planJsonSchema(),
        thinkingConfig: { includeThoughts: true },
        abortSignal: signal,
      },
    });
    let text = '';
    let thoughts = '';
    let note: string | undefined;
    let finishReason: string | undefined;
    let blockReason: string | undefined;
    let modelVersion = model;
    for await (const chunk of stream as AsyncGenerator<GenerateContentResponse>) {
      const candidate = chunk.candidates?.[0];
      for (const part of candidate?.content?.parts ?? []) {
        if (!part.text) continue;
        if (part.thought) {
          thoughts += part.text;
          note = lastLine(thoughts) ?? note;
          onProgress?.({ phase: 'thinking', note, written: text.length });
        } else {
          text += part.text;
          onProgress?.({ phase: 'writing', note, written: text.length });
        }
      }
      finishReason = candidate?.finishReason ?? finishReason;
      blockReason = chunk.promptFeedback?.blockReason ?? blockReason;
      modelVersion = chunk.modelVersion ?? modelVersion;
    }
    if (signal?.aborted) throw new AssistantError('Stopped.');
    const plan = readGeminiAnswer(text, finishReason, blockReason);
    const nativeMessage: Content = { role: 'model', parts: [{ text }] };
    return { plan, nativeMessage, rawText: text, model: modelVersion };
  } catch (err) {
    throw describeGeminiError(err);
  }
}

/** Files first (images and PDFs inline, other files as text), then the user's text. */
function userContent(text: string, attachments: Attachment[] = []): Content {
  const parts: Part[] = attachments.map((a) => (a.kind === 'text' ? { text: attachmentAsText(a) } : { inlineData: { mimeType: a.mediaType, data: a.data } }));
  return { role: 'user', parts: [...parts, { text }] };
}

export const geminiProvider: AssistantProvider = {
  id: 'gemini',
  label: 'Google Gemini',
  keyUrl: 'https://aistudio.google.com/apikey',
  keyUrlLabel: 'Google AI Studio',
  keyPlaceholder: 'AIza…',
  keyHint: 'Gemini API keys are long strings of letters, digits, "-" and "_", usually starting with "AIza".',
  looksLikeKey: (value) => /^[A-Za-z0-9_.-]{30,}$/.test(value.trim()),
  models: [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: 'Recommended: fast and capable' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon', note: 'Deeper reasoning, slower' },
  ],
  defaultModel: 'gemini-3.8-flash',
  userMessage: userContent,
  fromTranscript: (turns) => turns.map((t): Content => (t.role === 'user' ? userContent(t.text, t.attachments) : { role: 'model', parts: [{ text: t.text }] })),
  requestDesign,
};
