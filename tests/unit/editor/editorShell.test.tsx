import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { EditorShell } from '@/components/editor/EditorShell';
import { createBlankDesign } from '@/services/designActions';
import { designRepository } from '@/services/designRepository';
import { cloneTemplateDocument, templateRepository } from '@/services/templateService';
import { selectActivePage, useEditorStore } from '@/state/editorStore';

function renderEditor(doc = createBlankDesign(), persisted = false) {
  useEditorStore.getState().load(doc, { persisted });
  render(
    <MemoryRouter>
      <EditorShell />
    </MemoryRouter>,
  );
  return doc;
}

const canvasItems = () => document.querySelectorAll('[data-canvas-item]');

describe('EditorShell', () => {
  beforeEach(() => useEditorStore.getState().reset());

  it('shows an empty canvas, the visual library and page settings for a blank design (EDT-01)', () => {
    renderEditor();
    expect(screen.getByText('Drag a visual onto the canvas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add KPI card' })).toBeInTheDocument();
    expect(screen.getByText('Select a visual on the canvas to edit it.')).toBeInTheDocument();
    expect(screen.getByTestId('save-status')).toHaveTextContent('Not saved yet');
  });

  it('adds a visual by clicking a library item and selects it (EDT-03, EDT-06)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add Bar chart' }));
    expect(canvasItems()).toHaveLength(1);
    expect(canvasItems()[0]).toHaveAttribute('data-selected');
    expect(screen.getByRole('heading', { name: 'Bar chart', level: 2 })).toBeInTheDocument();
  });

  it('updates the canvas immediately when the title changes (EDT-07)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add Line chart' }));
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Weekly Orders');
    expect(within(canvasItems()[0] as HTMLElement).getByText('Weekly Orders')).toBeInTheDocument();
  });

  it('duplicates and deletes the selected visual with buttons and keys (EDT-08, EDT-09)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add KPI card' }));
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(canvasItems()).toHaveLength(2);
    // Backspace inside a text field must not delete the visual.
    const label = screen.getByLabelText('Label');
    await user.click(label);
    await user.keyboard('{Backspace}');
    expect(canvasItems()).toHaveLength(2);
    // Delete key on the canvas removes only the selected visual.
    (canvasItems()[1] as HTMLElement).focus();
    await user.keyboard('{Delete}');
    expect(canvasItems()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(canvasItems()).toHaveLength(2);
  });

  it('moves the selected visual with arrow keys and edits position numerically', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add KPI card' }));
    (canvasItems()[0] as HTMLElement).focus();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('spinbutton', { name: 'X' })).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'Y' })).toHaveValue(1);
    const w = screen.getByRole('spinbutton', { name: 'W' });
    await user.clear(w);
    await user.type(w, '20{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(/inside the page/);
  });

  it('adds, renames and deletes pages with confirmation (EDT-10, EDT-11)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('tab', { name: 'Pages' }));
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Add page' }));
    const pages = screen.getByRole('list', { name: 'Pages' });
    expect(within(pages).getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Rename Page 2' }));
    const input = within(pages).getByRole('textbox', { name: 'Page name' });
    await user.clear(input);
    await user.type(input, 'Details{Enter}');
    expect(within(pages).getByText('Details')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete Details' }));
    expect(screen.getByRole('heading', { name: 'Delete “Details”?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(within(pages).getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Delete Details' }));
    await user.click(screen.getByRole('button', { name: 'Delete page' }));
    expect(within(pages).getAllByRole('listitem')).toHaveLength(1);
  });

  it('autosaves after a change and reports it (SAV-01)', async () => {
    const user = userEvent.setup();
    const doc = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add Gauge' }));
    // 800 ms debounce + IndexedDB write; allow headroom when the suite runs in parallel.
    expect(await screen.findByText('Your changes are saved', {}, { timeout: 12_000 })).toBeInTheDocument();
    const stored = await designRepository.get(doc.id);
    expect(stored?.pages[0]!.components.map((c) => c.type)).toEqual(['gauge']);
  });

  it('opens a template copy with all its visuals and lists its pages', async () => {
    const user = userEvent.setup();
    const copy = cloneTemplateDocument(templateRepository.get('sales-performance')!.template);
    renderEditor(copy, true);
    expect(canvasItems()).toHaveLength(copy.pages[0]!.components.length);
    await user.click(screen.getByRole('tab', { name: 'Pages' }));
    await user.click(screen.getByRole('button', { name: /^Pipeline/ }));
    expect(selectActivePage(useEditorStore.getState())!.name).toBe('Pipeline');
    expect(canvasItems()).toHaveLength(copy.pages[1]!.components.length);
  });

  it('prevents editing in preview mode', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('button', { name: 'Add KPI card' }));
    await user.click(screen.getByRole('button', { name: /Preview/ }));
    expect(screen.getByTestId('editor-preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add KPI card' })).toBeNull();
    expect(canvasItems()).toHaveLength(0);
    await act(async () => {
      await user.keyboard('{Escape}');
    });
    expect(screen.queryByTestId('editor-preview')).toBeNull();
  });
});
