import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * The AI assistant against a mocked Anthropic Messages API (streamed server-sent
 * events), so no real key or credit is used. Checks what is sent and what the
 * user sees.
 */

const FAKE_KEY = `sk-ant-test-${'x'.repeat(32)}`;
const fmt = { kind: 'currency', currency: 'USD', decimals: 1, compact: true, suffix: '' };
const box = (x: number, y: number, w: number, h: number, title = '', subtitle = '') => ({ x, y, w, h, title, subtitle });
const kpi = (title: string, x: number, value: number) => ({
  type: 'kpi',
  ...box(x, 2, 3, 4, title),
  value,
  format: fmt,
  changePercent: 5.1,
  changeLabel: 'vs last year',
  target: 0,
  showTarget: false,
  sparkline: [1, 3, 2, 4],
  lowerIsBetter: false,
});

function plan(extraKpi: boolean) {
  return {
    kind: 'design',
    reply: extraKpi ? 'Added a churn KPI to the overview.' : 'Here is a one-page sales overview with revenue, pipeline and top products.',
    name: 'Regional sales overview',
    description: 'Revenue versus target for the sales director.',
    themeId: 'vibrant',
    categoryId: 'sales-marketing',
    pages: [
      {
        name: 'Overview',
        visuals: [
          { type: 'text', ...box(0, 0, 9, 2), text: 'Regional sales overview', style: 'heading' },
          { type: 'slicer', ...box(9, 0, 3, 3), field: 'Region', options: ['North', 'South'], style: 'dropdown' },
          kpi('Revenue', 0, 2_400_000),
          kpi('Pipeline', 3, 5_100_000),
          ...(extraKpi ? [{ ...kpi('Churn rate', 6, 3.1), lowerIsBetter: true, format: { ...fmt, kind: 'percent', currency: '' } }] : []),
          {
            type: 'bar',
            ...box(0, 6, 6, 9, 'Revenue by region'),
            categories: ['North', 'South', 'East'],
            series: [{ name: 'Revenue', values: [900, 800, 700] }],
            format: fmt,
            horizontal: false,
            showLegend: false,
            showDataLabels: false,
          },
          {
            type: 'line',
            ...box(6, 6, 6, 9, 'Monthly trend'),
            categories: ['Jan', 'Feb', 'Mar'],
            series: [{ name: 'Revenue', values: [1, 2, 3] }],
            format: fmt,
            horizontal: false,
            showLegend: false,
            showDataLabels: false,
          },
        ],
      },
    ],
  };
}

/** A streamed Messages API response whose text block is the given JSON. */
function sse(json: unknown): string {
  const text = JSON.stringify(json);
  const half = Math.floor(text.length / 2);
  const events: [string, unknown][] = [
    [
      'message_start',
      {
        type: 'message_start',
        message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } },
      },
    ],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '**Planning the overview page**' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(0, half) } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(half) } }],
    ['content_block_stop', { type: 'content_block_stop', index: 1 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 500 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}

interface Captured {
  headers: Record<string, string>;
  body: { model: string; messages: { role: string; content: unknown }[]; output_config: { format: { type: string } }; fallbacks: unknown; stream: boolean };
}

async function mockApi(page: Page, respond: (route: Route, n: number) => Promise<void>) {
  const requests: Captured[] = [];
  await page.route('https://api.anthropic.com/v1/messages**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    requests.push({ headers: await req.allHeaders(), body: req.postDataJSON() as Captured['body'] });
    await respond(route, requests.length);
  });
  return requests;
}

const streamResponse = (route: Route, json: unknown) =>
  route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(json) });

async function connectKey(page: Page) {
  await page.goto('/assistant');
  await expect(page.getByRole('radio', { name: 'Anthropic Claude' })).toBeChecked();
  const input = page.getByRole('textbox', { name: 'Anthropic Claude API key' });
  await input.fill('not-a-key');
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByRole('alert')).toContainText('sk-ant-');
  await input.fill(FAKE_KEY);
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByRole('region', { name: 'AI connection' })).toContainText('Anthropic Claude · Claude Opus 5.5');
}

test('assistant: brief, design, refinement, open in editor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = await mockApi(page, (route, n) => streamResponse(route, plan(n > 1)));
  await connectKey(page);

  // The composer is disabled until a key exists; examples only fill the box.
  await page.getByRole('button', { name: 'Sales performance' }).click();
  await expect(page.getByLabel('Describe the dashboard you need')).toHaveValue(/regional sales director/);
  await page.getByRole('button', { name: 'Design it' }).click();

  await expect(page.getByRole('log')).toContainText('one-page sales overview');
  const preview = page.getByRole('region', { name: 'Design preview' });
  await expect(preview).toContainText('Version 1');
  await expect(preview).toContainText('Revenue by region');
  await expect(preview).toContainText('Sample data');

  // What was sent: the user's key, the model, structured output and refusal fallback.
  expect(requests[0]!.headers['authorization']).toBe(`Bearer ${FAKE_KEY}`); // how SDK 1.x sends an API key
  expect(requests[0]!.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(requests[0]!.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
  expect(requests[0]!.body.model).toBe('claude-opus-5-5');
  expect(requests[0]!.body.output_config.format.type).toBe('json_schema');
  expect(requests[0]!.body.fallbacks).toBe('default');
  expect(requests[0]!.body.messages).toHaveLength(1);

  // Follow-up: the whole conversation (including the assistant's previous turn) is sent back.
  await page.getByLabel('Ask for changes').fill('Add a churn KPI');
  await page.getByLabel('Ask for changes').press('Enter');
  await expect(page.getByRole('log')).toContainText('Added a churn KPI');
  await expect(preview).toContainText('Version 2');
  await expect(preview).toContainText('Churn rate');
  expect(requests[1]!.body.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(JSON.stringify(requests[1]!.body.messages[1]!.content)).toContain('"thinking"');

  await page.getByRole('button', { name: 'Open in editor' }).click();
  await expect(page).toHaveURL(/\/editor\/design-/);
  await expect(page.locator('[data-canvas-item]')).toHaveCount(7);
  await expect(page.getByTestId('save-status')).toHaveText(/saved/i);
  expect(errors).toEqual([]);
});

test('assistant: images and other files can be attached, checked and sent with the brief', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = await mockApi(page, (route) => streamResponse(route, plan(false)));
  await connectKey(page);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const picker = page.getByLabel('Attach files');
  await picker.setInputFiles([
    { name: 'sketch.png', mimeType: 'image/png', buffer: png },
    { name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from('Region,Revenue\nNorth,1200\nSouth,900') },
    { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Keep it simple.') },
  ]);
  const pending = page.getByRole('list', { name: 'Files to send' });
  await expect(pending.getByRole('listitem')).toHaveCount(3);
  await expect(pending).toContainText('sales.csv');
  await expect(pending.locator('img')).toHaveCount(1); // image thumbnail
  await pending.getByRole('button', { name: 'Remove notes.txt' }).click();
  await expect(pending.getByRole('listitem')).toHaveCount(2);

  // Unsupported files are explained and not added.
  await picker.setInputFiles([{ name: 'tool.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') }]);
  await expect(page.getByRole('alert')).toContainText('not a supported file type');
  await expect(pending.getByRole('listitem')).toHaveCount(2);

  // Files alone can be sent: the brief defaults to "design from the attached files".
  await page.getByRole('button', { name: 'Design it' }).click();
  await expect(page.getByRole('region', { name: 'Design preview' })).toContainText('Version 1');
  const content = requests[0]!.body.messages[0]!.content as { type: string; source?: { type: string; media_type: string; data: string }; title?: string; text?: string }[];
  expect(content.map((b) => b.type)).toEqual(['image', 'document', 'text']);
  expect(content[0]!.source).toMatchObject({ type: 'base64', media_type: 'image/png', data: png.toString('base64') });
  expect(content[1]).toMatchObject({ title: 'sales.csv', source: { type: 'text', media_type: 'text/plain', data: 'Region,Revenue\nNorth,1200\nSouth,900' } });
  expect(content[2]!.text).toMatch(/attached file/i);
  // The conversation shows what was sent; the composer is cleared.
  await expect(page.getByRole('log').getByRole('list', { name: 'Attached files' })).toContainText('sketch.png');
  await expect(page.getByRole('list', { name: 'Files to send' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('assistant: API errors are explained and can be retried; the key can be forgotten', async ({ page }) => {
  await mockApi(page, async (route, n) => {
    if (n === 1) {
      await route.fulfill({
        status: 401,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }),
      });
    } else {
      await streamResponse(route, plan(false));
    }
  });
  await connectKey(page);
  await page.getByLabel('Describe the dashboard you need').fill('A sales dashboard');
  await page.getByRole('button', { name: 'Design it' }).click();
  await expect(page.getByRole('alert')).toContainText('API key was not accepted');

  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('region', { name: 'Design preview' })).toContainText('Version 1');

  await page.getByRole('button', { name: 'Forget key' }).click();
  await expect(page.getByRole('textbox', { name: 'Anthropic Claude API key' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bi-design-studio:anthropic-api-key'))).toBeNull();
});

/* ---------------- Google Gemini ---------------- */

const GEMINI_KEY = `AIzaSy${'G'.repeat(33)}`;

/** A streamed generateContent response (alt=sse): a thought summary, then the JSON answer in two chunks. */
function geminiSse(json: unknown): string {
  const text = JSON.stringify(json);
  const half = Math.floor(text.length / 2);
  const chunk = (parts: object[], finishReason?: string) =>
    `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, ...(finishReason ? { finishReason } : {}), index: 0 }], modelVersion: 'gemini-3.8-flash' })}\r\n\r\n`;
  return chunk([{ text: '**Planning the KPI row**', thought: true }]) + chunk([{ text: text.slice(0, half) }]) + chunk([{ text: text.slice(half) }], 'STOP');
}

interface GeminiCaptured {
  url: string;
  headers: Record<string, string>;
  body: {
    contents: { role: string; parts: { text: string }[] }[];
    systemInstruction?: unknown;
    generationConfig: { responseMimeType: string; responseJsonSchema: unknown; thinkingConfig?: { includeThoughts?: boolean } };
  };
}

test('assistant with Google Gemini: choose provider, design, refine, open in editor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests: GeminiCaptured[] = [];
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    requests.push({ url: req.url(), headers: await req.allHeaders(), body: req.postDataJSON() as GeminiCaptured['body'] });
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: geminiSse(plan(requests.length > 1)) });
  });

  await page.goto('/assistant');
  await page.getByRole('radio', { name: 'Google Gemini' }).check();
  await expect(page.getByLabel('Model')).toHaveValue('gemini-3.8-flash');
  const input = page.getByRole('textbox', { name: 'Google Gemini API key' });
  await input.fill('nope');
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByRole('alert')).toContainText('AIza');
  await input.fill(GEMINI_KEY);
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByRole('region', { name: 'AI connection' })).toContainText('Google Gemini · Gemini 3.8 Flash');

  await page.getByLabel('Describe the dashboard you need').fill('A sales dashboard for the regional director');
  await page.getByRole('button', { name: 'Design it' }).click();
  const preview = page.getByRole('region', { name: 'Design preview' });
  await expect(preview).toContainText('Version 1');
  await expect(preview).toContainText('Revenue by region');

  // What was sent: streaming endpoint for the chosen model, the key, JSON schema output, thought summaries.
  const first = requests[0]!;
  expect(first.url).toContain('/models/gemini-3.8-flash:streamGenerateContent');
  expect(first.headers['x-goog-api-key']).toBe(GEMINI_KEY);
  expect(first.body.generationConfig.responseMimeType).toBe('application/json');
  expect(JSON.stringify(first.body.generationConfig.responseJsonSchema)).not.toContain('"$ref"');
  expect(first.body.generationConfig.thinkingConfig?.includeThoughts).toBe(true);
  expect(first.body.systemInstruction).toBeTruthy();
  expect(first.body.contents.map((c) => c.role)).toEqual(['user']);

  await page.getByLabel('Ask for changes').fill('Add a churn KPI');
  await page.getByLabel('Ask for changes').press('Enter');
  await expect(preview).toContainText('Version 2');
  await expect(preview).toContainText('Churn rate');
  expect(requests[1]!.body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);

  // The choice is remembered for the next visit.
  await page.reload();
  await expect(page.getByRole('region', { name: 'AI connection' })).toContainText('Google Gemini');

  expect(errors).toEqual([]);
});

test('Gemini errors (invalid key) are explained', async ({ page }) => {
  await page.route('https://generativelanguage.googleapis.com/**', (route) =>
    route.fulfill({
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }),
    }),
  );
  await page.goto('/assistant');
  await page.getByRole('radio', { name: 'Google Gemini' }).check();
  await page.getByRole('textbox', { name: 'Google Gemini API key' }).fill(GEMINI_KEY);
  await page.getByRole('button', { name: 'Save key' }).click();
  await page.getByLabel('Describe the dashboard you need').fill('A sales dashboard');
  await page.getByRole('button', { name: 'Design it' }).click();
  await expect(page.getByRole('alert')).toContainText('Gemini API key was not accepted');
});

/* ---------------- OpenAI ---------------- */

const OPENAI_KEY = `sk-proj-${'O'.repeat(40)}`;

/** A streamed Responses API answer (server-sent events): one message item whose text is the JSON plan. */
function openaiSse(json: unknown, id: string): string {
  const text = JSON.stringify(json);
  const half = Math.floor(text.length / 2);
  const base = { id, object: 'response', created_at: 1, model: 'gpt-6.1-sol', status: 'in_progress', output: [] as unknown[], incomplete_details: null, error: null };
  const item = { type: 'message', id: 'msg_1', role: 'assistant', status: 'in_progress', content: [] as unknown[] };
  const part = { type: 'output_text', text: '', annotations: [] };
  const done = { ...item, status: 'completed', content: [{ ...part, text }] };
  const events: object[] = [
    { type: 'response.created', response: base },
    { type: 'response.output_item.added', output_index: 0, item },
    { type: 'response.content_part.added', output_index: 0, item_id: 'msg_1', content_index: 0, part },
    { type: 'response.output_text.delta', output_index: 0, item_id: 'msg_1', content_index: 0, delta: text.slice(0, half), logprobs: [] },
    { type: 'response.output_text.delta', output_index: 0, item_id: 'msg_1', content_index: 0, delta: text.slice(half), logprobs: [] },
    { type: 'response.output_text.done', output_index: 0, item_id: 'msg_1', content_index: 0, text, logprobs: [] },
    { type: 'response.content_part.done', output_index: 0, item_id: 'msg_1', content_index: 0, part: { ...part, text } },
    { type: 'response.output_item.done', output_index: 0, item: done },
    { type: 'response.completed', response: { ...base, status: 'completed', output: [done] } },
  ];
  return events.map((e, i) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify({ ...e, sequence_number: i })}\n\n`).join('');
}

interface OpenAICaptured {
  headers: Record<string, string>;
  body: { model: string; stream: boolean; store: boolean; instructions?: string; input: { role: string }[]; text: { format: { type: string; strict: boolean; schema: unknown } } };
}

test('assistant with OpenAI: choose provider, design, refine', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests: OpenAICaptured[] = [];
  await page.route('https://api.openai.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
    requests.push({ headers: await req.allHeaders(), body: req.postDataJSON() as OpenAICaptured['body'] });
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: openaiSse(plan(requests.length > 1), `resp_${requests.length}`) });
  });

  await page.goto('/assistant');
  await page.getByRole('radio', { name: 'OpenAI' }).check();
  await expect(page.getByLabel('Model')).toHaveValue('gpt-6.1-sol');
  const input = page.getByRole('textbox', { name: 'OpenAI API key' });
  await input.fill(`sk-ant-${'a'.repeat(30)}`); // an Anthropic key in the wrong place
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByRole('alert')).toContainText('sk-');
  await input.fill(OPENAI_KEY);
  await page.getByRole('button', { name: 'Save key' }).click();
  await expect(page.getByRole('region', { name: 'AI connection' })).toContainText('OpenAI · GPT-6.1 Sol');

  await page.getByLabel('Describe the dashboard you need').fill('A sales dashboard for the regional director');
  await page.getByRole('button', { name: 'Design it' }).click();
  const preview = page.getByRole('region', { name: 'Design preview' });
  await expect(preview).toContainText('Version 1');
  await expect(preview).toContainText('Revenue by region');

  const first = requests[0]!;
  expect(first.headers['authorization']).toBe(`Bearer ${OPENAI_KEY}`);
  expect(first.body.model).toBe('gpt-6.1-sol');
  expect(first.body.stream).toBe(true);
  expect(first.body.store).toBe(false);
  expect(first.body.instructions).toBeTruthy();
  expect(first.body.text.format.type).toBe('json_schema');
  expect(first.body.text.format.strict).toBe(true);
  expect(first.body.input.map((m) => m.role)).toEqual(['user']);

  await page.getByLabel('Ask for changes').fill('Add a churn KPI');
  await page.getByLabel('Ask for changes').press('Enter');
  await expect(preview).toContainText('Version 2');
  await expect(preview).toContainText('Churn rate');
  expect(requests[1]!.body.input.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(errors).toEqual([]);
});

test('OpenAI errors (invalid key) are explained', async ({ page }) => {
  await page.route('https://api.openai.com/**', (route) =>
    route.fulfill({
      status: 401,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', code: 'invalid_api_key' } }),
    }),
  );
  await page.goto('/assistant');
  await page.getByRole('radio', { name: 'OpenAI' }).check();
  await page.getByRole('textbox', { name: 'OpenAI API key' }).fill(OPENAI_KEY);
  await page.getByRole('button', { name: 'Save key' }).click();
  await page.getByLabel('Describe the dashboard you need').fill('A sales dashboard');
  await page.getByRole('button', { name: 'Design it' }).click();
  await expect(page.getByRole('alert')).toContainText('OpenAI API key was not accepted');
});

test('the AI chat is docked next to the navigation and can be hidden and shown again', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/assistant');
  const chat = page.getByRole('complementary', { name: 'AI chat' });
  await expect(chat).toBeVisible();
  // Docked on the left, directly against the navigation and before the preview.
  const nav = (await page.getByRole('navigation', { name: 'Primary' }).boundingBox())!;
  const box = (await chat.boundingBox())!;
  const preview = (await page.getByRole('region', { name: 'Design preview' }).boundingBox())!;
  expect(Math.abs(box.x - (nav.x + nav.width))).toBeLessThanOrEqual(2);
  expect(box.x + box.width).toBeLessThanOrEqual(preview.x);
  expect(box.height).toBeGreaterThan(800); // full height

  // Resize by dragging the splitter on the chat's right edge; the width is remembered.
  const handle = page.getByRole('separator', { name: 'Resize chat' });
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + 300);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + 300, { steps: 4 });
  await page.mouse.move(h.x + h.width / 2 + 150, h.y + 300, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await chat.boundingBox())!.width)).toBeGreaterThanOrEqual(Math.round(box.width) + 140);
  const resized = Math.round((await chat.boundingBox())!.width);
  await page.reload();
  await expect.poll(async () => Math.round((await chat.boundingBox())!.width)).toBe(resized);
  // Keyboard: arrow keys on the focused splitter.
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => Math.round((await chat.boundingBox())!.width)).toBe(resized - 20);

  await page.getByRole('button', { name: 'Hide chat' }).click();
  await expect(chat).toHaveCount(0);
  const wider = (await page.getByRole('region', { name: 'Design preview' }).boundingBox())!;
  expect(wider.width).toBeGreaterThan(preview.width + 150);

  // Remembered across visits.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show chat' })).toBeVisible();
  await page.getByRole('button', { name: 'Show chat' }).click();
  await expect(chat).toBeVisible();
});

test('assistant is in the main navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'AI Design Assistant' }).click();
  await expect(page.getByRole('heading', { name: 'AI Design Assistant' })).toBeVisible();
  await expect(page.getByText('Coming later')).toHaveCount(0);
});
