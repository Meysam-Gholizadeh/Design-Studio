# AI Design Assistant

Scope change (2026-11-05, requested by the user): the assistant drafts a dashboard design from a written brief. It is the only feature that uses AI; everything else (HTML import, layouts, export) stays deterministic.

The same day, Google Gemini was added as a second provider (user request: the user has a Gemini key). The user picks **Anthropic Claude** or **Google Gemini** and a model; everything else is shared:
- the design-plan schema;
- the prompt;
- the repair step;
- the UI.

On 2026-11-06 **OpenAI** was added as a third provider (user request). The user now picks Anthropic Claude, Google Gemini or OpenAI.

## User flow
1. **AI Design Assistant** in the sidebar (`/assistant`).
2. The user chooses a provider and model, then connects **their own API key** for it (decision: no server in the MVP).
   - Keys are kept per provider, in this browser: local storage when "Remember" is ticked, otherwise session storage for the tab.
   - "Forget key" removes the key. The chosen provider and models are remembered.
   - Requests use the user's own account quota or billing.
3. The user describes the dashboard (audience, questions, KPIs, pages). Example briefs fill the box; nothing is sent until the user presses **Design it**.
4. The assistant replies in 2–4 sentences (what it designed and the assumptions it made) and the preview shows the design.
5. Follow-up messages ("add a churn KPI", "make page 2 about regions") return an updated design, Version 2, 3, ….
6. **Open in editor** saves the current version as a new local design and opens it.
   - Each version has its own id, so opening a newer version never overwrites one already edited.
   - The conversation lives in memory for the tab: it survives moving between sections, not a reload.

## Providers
| | Anthropic Claude | Google Gemini | OpenAI |
|---|---|---|---|
| Module | `providers/anthropic.ts` | `providers/gemini.ts` | `providers/openai.ts` |
| SDK | `@anthropic-ai/sdk` (browser mode, `dangerouslyAllowBrowser`) | `@google/genai` (browser build) | `openai` 7.x, Responses API (browser mode, `dangerouslyAllowBrowser`) |
| Models | `claude-opus-5-5` | `gemini-3.8-flash` (default), `gemini-4-argon` | `gpt-6.1-sol` (default), `gpt-6-astra`, `gpt-6-luna` |
| Output shape | Structured output: `output_config.format` from the Zod schema (`betaZodOutputFormat`) | `responseMimeType: application/json` + `responseJsonSchema` from `planJsonSchema.ts`: inlined; `const` → one-value `enum`; no `$ref` or numeric bounds | `text.format` `json_schema` with `strict: true`, from `strictPlanJsonSchema()`: the same schema, with every property required and `additionalProperties: false` (the plan has no optional fields, so validity is unchanged) |
| Reasoning / progress | Adaptive thinking, `display: summarized`, effort `medium` | `thinkingConfig.includeThoughts` (thought summaries) | `reasoning.effort: medium`. No reasoning summaries are requested, because some OpenAI organisations must be verified first; progress shows "thinking", then characters written |
| Declines | `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) retries on Anthropic's recommended model; final refusal explained | Safety / prohibited / blocked finish reasons explained | `refusal` content or a `content_filter` stop explained |
| History | Assistant turns sent back exactly as returned (thinking blocks included) | `role: model` turns with the JSON text | `store: false` (nothing kept on OpenAI); assistant turns resent as text |

Gemini model ids come from Google's model list (checked 2026-11-05); `gemini-2.5-*` models are deprecated. OpenAI model ids come from OpenAI's API changelog (checked 2026-11-06). Unavailable models produce a clear "choose another model" message. OpenAI keys start with `sk-` (`sk-ant-` keys are rejected locally as Anthropic keys). OpenAI quota errors (`insufficient_quota`) are explained separately from rate limits.

The **conversation** keeps a provider-neutral transcript plus the active provider's own history. If the user switches provider mid-conversation, the history is rebuilt from the transcript.

## Shared pipeline
| Step | Module |
|---|---|
| Provider contracts, errors, plan parsing | `src/services/assistant/types.ts` |
| Response schema ("design plan") | `src/services/assistant/designPlan.ts` |
| System prompt (fixed, cacheable) | `src/services/assistant/systemPrompt.ts` |
| Plan → `DashboardDocument` (pure, defensive) | `src/services/assistant/planToDocument.ts` |
| Conversation state | `src/state/assistantStore.ts` |
| Key and choice storage | `src/services/assistant/apiKeyStore.ts` |
| UI | `src/pages/AssistantPage.tsx`, `src/components/assistant/*` |

The plan is deliberately flat: no optional fields, and a single union (the eight visual kinds: KPI, bar/line/area/stacked bar, combo, pie/donut, table, gauge, slicer, text) on a 12 × 24 grid per page.

**Never trusted as-is.** The text is parsed and validated again with Zod. `planToDocument` then:
- trims text to schema limits and makes numbers finite;
- aligns series with categories and keeps slice values non-negative;
- fixes invalid gauge ranges, normalises currency codes, gives table columns unique keys and parses numeric cells;
- clamps sizes to each visual's minimum and the grid;
- moves overlapping or out-of-grid visuals to the nearest free space, and anything that still does not fit to an extra page (never dropped).

Every repair is listed under the assistant's reply. The finished document passes `validateDashboardDocument` before it is shown.

**Provenance.** Generated designs carry `source: { kind: 'ai-assistant', model, generatedAt }`. Values are fictional sample data, so the usual "Sample data" notice and export wording apply (unlike HTML imports, whose values are placeholders copied from the file).

## Errors shown to the user
Each is explained in plain language, and retryable cases offer **Try again**:
- the key was not accepted;
- no permission or the model isn't available;
- no Anthropic credit;
- rate limit or quota reached;
- the API is busy;
- no connection;
- the request was declined;
- the answer was too long;
- the answer was unreadable.

## Privacy and security notes
- The brief and the conversation are sent to the chosen provider's API; nothing else from the studio is sent.
- A remembered key is readable by anyone with access to the browser profile. The panel says so and offers "Forget key". A server-side proxy would remove this exposure and is the recommended next step before any shared or hosted deployment.

## Tests
- `tests/unit/assistant/planToDocument.test.ts` covers:
  - a valid document;
  - data repairs, overlap and grid repair, overflow to an extra page;
  - tables, slices, gauges, slicers and text;
  - theme and category handling, empty plans.
- `tests/unit/assistant/providers.test.ts` covers:
  - plan parsing;
  - for each provider: refusal and truncation handling, API error messages, key format, history rebuilt from the transcript;
  - the Gemini JSON Schema's keyword restrictions and the OpenAI strict-schema rules.
- `tests/e2e/assistant.spec.ts` runs against mocked, streamed APIs (Anthropic Messages SSE, Gemini `streamGenerateContent?alt=sse`, OpenAI Responses SSE). It covers, for all three providers:
  - the full journey and what is sent: key header, model, schema, thoughts, conversation replay;
  - error explanations, retry and forgetting the key;
  - remembering the chosen provider; navigation.
- Not covered by tests: real calls to any of the APIs. The mocked tests check the request shape and the response handling; the first real request is made with the user's key.
