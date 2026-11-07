import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument } from '@/domain/defaults';
import { selectActivePage, selectSelectedComponent, useEditorStore } from '@/state/editorStore';

function load() {
  const doc = createEmptyDocument({ id: 'doc-1', pageId: 'page-1', themeId: 'corporate-blue', now: '2026-01-01T00:00:00.000Z' });
  useEditorStore.getState().load(doc, { persisted: false });
}

const s = () => useEditorStore.getState();

describe('editor store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    load();
  });

  it('adds a visual, selects it and bumps the version', () => {
    expect(s().addVisual('kpi').ok).toBe(true);
    expect(selectActivePage(s())!.components).toHaveLength(1);
    expect(selectSelectedComponent(s())?.type).toBe('kpi');
    expect(s().version).toBe(1);
    expect(s().document!.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('undoes and redoes document changes', () => {
    s().addVisual('kpi');
    s().addVisual('bar');
    expect(selectActivePage(s())!.components).toHaveLength(2);
    s().undo();
    expect(selectActivePage(s())!.components).toHaveLength(1);
    s().undo();
    expect(selectActivePage(s())!.components).toHaveLength(0);
    expect(s().selectedId).toBeNull(); // selection dropped when the visual disappears
    s().redo();
    s().redo();
    expect(selectActivePage(s())!.components.map((c) => c.type)).toEqual(['kpi', 'bar']);
  });

  it('clears the redo stack after a new change', () => {
    s().addVisual('kpi');
    s().undo();
    s().addVisual('bar');
    expect(s().future).toHaveLength(0);
  });

  it('coalesces rapid typing into one undo step', () => {
    s().addVisual('bar');
    const id = s().selectedId!;
    for (const title of ['R', 'Re', 'Rev', 'Revenue']) s().updateComponent(id, (d) => void (d.title = title), 'title');
    expect(selectSelectedComponent(s())!.title).toBe('Revenue');
    s().undo();
    expect(selectSelectedComponent(s())!.title).toBe('Revenue by Region');
  });

  it('starts a new undo step after a pause in typing', () => {
    vi.useFakeTimers();
    s().addVisual('bar');
    const id = s().selectedId!;
    s().updateComponent(id, (d) => void (d.title = 'A'), 'title');
    vi.advanceTimersByTime(2000);
    s().updateComponent(id, (d) => void (d.title = 'AB'), 'title');
    s().undo();
    expect(selectSelectedComponent(s())!.title).toBe('A');
  });

  it('records one history entry per drag (only on commit) and none for no-op layouts', () => {
    s().addVisual('bar');
    const id = s().selectedId!;
    const before = s().past.length;
    const l = selectSelectedComponent(s())!.layout;
    s().applyLayouts([{ i: id, x: l.x, y: l.y, w: l.w, h: l.h }]);
    expect(s().past.length).toBe(before);
    s().applyLayouts([{ i: id, x: 4, y: 2, w: l.w, h: l.h }]);
    expect(s().past.length).toBe(before + 1);
  });

  it('selection changes are not undoable document changes', () => {
    s().addVisual('kpi');
    const version = s().version;
    s().select(null);
    expect(s().version).toBe(version);
  });

  it('nudges the selected visual with the keyboard and refuses invalid moves', () => {
    s().addVisual('kpi');
    expect(s().nudgeSelected(1, 0).ok).toBe(true);
    expect(selectSelectedComponent(s())!.layout.x).toBe(1);
    expect(s().nudgeSelected(0, -1).ok).toBe(false);
  });

  it('does not move locked visuals', () => {
    s().addVisual('kpi');
    const id = s().selectedId!;
    s().updateComponent(id, (d) => void (d.locked = true));
    s().nudgeSelected(1, 0);
    expect(selectSelectedComponent(s())!.layout.x).toBe(0);
  });

  it('switches to a neighbouring page when the active page is deleted', () => {
    s().addPage();
    const second = s().activePageId!;
    expect(s().deletePage(second).ok).toBe(true);
    expect(s().activePageId).toBe('page-1');
  });

  it('caps history length', () => {
    for (let i = 0; i < 120; i++) s().commit({ ...s().document!, name: `Name ${i}` });
    expect(s().past.length).toBeLessThanOrEqual(100);
  });

  it('tracks save state per version', () => {
    s().addVisual('kpi');
    const v = s().version;
    s().markSaving('doc-1');
    expect(s().saveStatus).toBe('saving');
    s().markSaved('doc-1', v);
    expect(s().persisted).toBe(true);
    expect(s().version).toBe(s().savedVersion);
    s().addVisual('bar');
    expect(s().version).not.toBe(s().savedVersion);
  });

  it('ignores save results for a design that is no longer open', () => {
    s().addVisual('kpi');
    const v = s().version;
    s().markSaved('some-other-design', v);
    expect(s().persisted).toBe(false);
    expect(s().savedVersion).toBe(0);
    s().markSaveError('some-other-design', 'boom');
    expect(s().saveStatus).toBe('idle');
  });
});
