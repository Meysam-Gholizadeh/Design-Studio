/**
 * Central editor state. All document changes go through `commit`, which
 * records undo history (one entry per user action — drags commit on drop,
 * typing is coalesced) and bumps `version` for autosave.
 */
import { create } from 'zustand';
import type { DashboardDocument } from '@/domain/schemas/document';
import type { ComponentLayout, DashboardComponent, VisualType } from '@/domain/schemas/visuals';
import * as ops from './documentOps';
import * as layoutOps from './layoutOps';
import type { LayoutMode } from './layoutOps';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1200;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type EditorMode = 'edit' | 'preview';
export type ActionResult = { ok: true } | { ok: false; reason: string };

const OK: ActionResult = { ok: true };

interface CommitOptions {
  /** Consecutive commits with the same key (within a short window) form one undo step. */
  coalesceKey?: string;
  select?: string | null;
  activePageId?: string;
}

export interface EditorState {
  document: DashboardDocument | null;
  /** Whether the document exists in storage (a fresh blank design is not saved until first edit). */
  persisted: boolean;
  activePageId: string | null;
  selectedId: string | null;
  past: DashboardDocument[];
  future: DashboardDocument[];
  lastCoalesce: { key: string; at: number } | null;
  /** Increments on every document change; autosave compares it with `savedVersion`. */
  version: number;
  savedVersion: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  mode: EditorMode;

  load(document: DashboardDocument, options: { persisted: boolean }): void;
  reset(): void;
  commit(next: DashboardDocument, options?: CommitOptions): void;
  undo(): void;
  redo(): void;

  setMode(mode: EditorMode): void;
  setActivePage(pageId: string): void;
  select(id: string | null): void;

  renameDocument(name: string): ActionResult;
  setCanvasSize(size: { width: number; height: number }): ActionResult;
  /** Switch the theme: styling only, never content or positions. One undo step. */
  setTheme(themeId: string): ActionResult;
  /** Apply a layout preset to the active page (see layoutOps). One undo step. */
  applyLayoutPreset(presetId: string, mode: LayoutMode): ActionResult & { overflow?: number };

  addVisual(type: VisualType, preferred?: { x: number; y: number }): ActionResult;
  updateComponent(id: string, recipe: (draft: DashboardComponent) => void, coalesceKey?: string): void;
  applyLayouts(items: readonly { i: string; x: number; y: number; w: number; h: number }[]): void;
  setComponentLayout(id: string, layout: Pick<ComponentLayout, 'x' | 'y' | 'w' | 'h'>): ActionResult;
  nudgeSelected(dx: number, dy: number, dw?: number, dh?: number): ActionResult;
  duplicateSelected(): ActionResult;
  deleteSelected(): void;
  deleteComponent(id: string): void;
  reorder(id: string, direction: ops.ReorderDirection): void;

  addPage(): ActionResult;
  renamePage(pageId: string, name: string): ActionResult;
  duplicatePage(pageId: string): ActionResult;
  deletePage(pageId: string): ActionResult;
  movePage(pageId: string, delta: -1 | 1): void;

  /** Save lifecycle. Results for a document that is no longer open are ignored. */
  markSaving(documentId: string): void;
  markSaved(documentId: string, version: number): void;
  markSaveError(documentId: string, message: string): void;
}

const initial = {
  document: null,
  persisted: false,
  activePageId: null,
  selectedId: null,
  past: [],
  future: [],
  lastCoalesce: null,
  version: 0,
  savedVersion: 0,
  saveStatus: 'idle' as SaveStatus,
  saveError: null,
  mode: 'edit' as EditorMode,
};

/** Keep active page and selection pointing at things that exist. */
function reconcile(doc: DashboardDocument, activePageId: string | null, selectedId: string | null) {
  const page = doc.pages.find((p) => p.id === activePageId) ?? doc.pages[0]!;
  const selected = selectedId && page.components.some((c) => c.id === selectedId) ? selectedId : null;
  return { activePageId: page.id, selectedId: selected };
}

export const useEditorStore = create<EditorState>()((set, get) => {
  /** Run an op that needs the active page. */
  const withPage = <T>(fn: (doc: DashboardDocument, pageId: string) => T): T | null => {
    const { document, activePageId } = get();
    if (!document || !activePageId) return null;
    return fn(document, activePageId);
  };

  return {
    ...initial,

    load(document, { persisted }) {
      set({
        ...initial,
        document,
        persisted,
        activePageId: document.pages[0]?.id ?? null,
      });
    },

    reset() {
      set({ ...initial });
    },

    commit(next, options = {}) {
      const s = get();
      const current = s.document;
      if (!current) return;
      const pageChange = options.activePageId !== undefined && options.activePageId !== s.activePageId;
      if (next === current) {
        if (options.select !== undefined || pageChange) {
          set(reconcile(current, options.activePageId ?? s.activePageId, options.select !== undefined ? options.select : s.selectedId));
        }
        return;
      }
      const now = Date.now();
      const coalesce = Boolean(options.coalesceKey && s.lastCoalesce?.key === options.coalesceKey && now - s.lastCoalesce.at < COALESCE_MS);
      const past = coalesce ? s.past : [...s.past, current].slice(-HISTORY_LIMIT);
      const document = { ...next, updatedAt: new Date(now).toISOString() };
      set({
        document,
        past,
        future: [],
        lastCoalesce: options.coalesceKey ? { key: options.coalesceKey, at: now } : null,
        version: s.version + 1,
        ...reconcile(document, options.activePageId ?? s.activePageId, options.select !== undefined ? options.select : s.selectedId),
      });
    },

    undo() {
      const s = get();
      const previous = s.past.at(-1);
      if (!s.document || !previous) return;
      set({
        document: previous,
        past: s.past.slice(0, -1),
        future: [s.document, ...s.future],
        lastCoalesce: null,
        version: s.version + 1,
        ...reconcile(previous, s.activePageId, s.selectedId),
      });
    },

    redo() {
      const s = get();
      const next = s.future[0];
      if (!s.document || !next) return;
      set({
        document: next,
        past: [...s.past, s.document],
        future: s.future.slice(1),
        lastCoalesce: null,
        version: s.version + 1,
        ...reconcile(next, s.activePageId, s.selectedId),
      });
    },

    setMode(mode) {
      set({ mode, selectedId: mode === 'preview' ? null : get().selectedId });
    },

    setActivePage(pageId) {
      const doc = get().document;
      if (doc?.pages.some((p) => p.id === pageId)) set({ activePageId: pageId, selectedId: null });
    },

    select(id) {
      if (get().selectedId !== id) set({ selectedId: id });
    },

    renameDocument(name) {
      const doc = get().document;
      if (!doc) return OK;
      const r = ops.renameDocument(doc, name);
      if (!r.ok) return r;
      get().commit(r.value, { coalesceKey: 'doc-name' });
      return OK;
    },

    setCanvasSize(size) {
      const doc = get().document;
      if (!doc) return OK;
      const r = ops.setCanvasSize(doc, size);
      if (!r.ok) return r;
      get().commit(r.value);
      return OK;
    },

    setTheme(themeId) {
      const doc = get().document;
      if (!doc) return OK;
      const r = layoutOps.setTheme(doc, themeId);
      if (!r.ok) return r;
      get().commit(r.value);
      return OK;
    },

    applyLayoutPreset(presetId, mode) {
      const r = withPage((doc, pageId) => layoutOps.applyLayoutPreset(doc, pageId, presetId, mode));
      if (!r) return OK;
      if (!r.ok) return r;
      get().commit(r.value.doc, { activePageId: r.value.pageId, select: null });
      return { ok: true, overflow: r.value.overflow };
    },

    addVisual(type, preferred) {
      const r = withPage((doc, pageId) => ops.addVisual(doc, pageId, type, preferred));
      if (!r) return OK;
      if (!r.ok) return r;
      get().commit(r.value.doc, { select: r.value.id });
      return OK;
    },

    updateComponent(id, recipe, coalesceKey) {
      const next = withPage((doc, pageId) => ops.updateComponent(doc, pageId, id, recipe));
      if (next) get().commit(next, { coalesceKey: coalesceKey ? `${id}:${coalesceKey}` : undefined });
    },

    applyLayouts(items) {
      const next = withPage((doc, pageId) => ops.applyLayouts(doc, pageId, items));
      if (next) get().commit(next);
    },

    setComponentLayout(id, layout) {
      const r = withPage((doc, pageId) => ops.setComponentLayout(doc, pageId, id, layout));
      if (!r) return OK;
      if (!r.ok) return r;
      get().commit(r.value);
      return OK;
    },

    nudgeSelected(dx, dy, dw = 0, dh = 0) {
      const { selectedId } = get();
      const page = withPage((doc, pageId) => ops.getPage(doc, pageId));
      const c = page?.components.find((x) => x.id === selectedId);
      if (!c || c.locked) return OK;
      const l = c.layout;
      return get().setComponentLayout(c.id, { x: l.x + dx, y: l.y + dy, w: l.w + dw, h: l.h + dh });
    },

    duplicateSelected() {
      const { selectedId } = get();
      if (!selectedId) return OK;
      const r = withPage((doc, pageId) => ops.duplicateComponent(doc, pageId, selectedId));
      if (!r) return OK;
      if (!r.ok) return r;
      get().commit(r.value.doc, { select: r.value.id });
      return OK;
    },

    deleteSelected() {
      const { selectedId } = get();
      if (selectedId) get().deleteComponent(selectedId);
    },

    deleteComponent(id) {
      const next = withPage((doc, pageId) => ops.deleteComponent(doc, pageId, id));
      if (next) get().commit(next, { select: get().selectedId === id ? null : get().selectedId });
    },

    reorder(id, direction) {
      const next = withPage((doc, pageId) => ops.reorderComponent(doc, pageId, id, direction));
      if (next) get().commit(next);
    },

    addPage() {
      const r = withPage((doc, pageId) => ops.addPage(doc, pageId));
      if (!r) return OK;
      if (!r.ok) return r;
      get().commit(r.value.doc, { activePageId: r.value.pageId, select: null });
      return OK;
    },

    renamePage(pageId, name) {
      const doc = get().document;
      if (!doc) return OK;
      const r = ops.renamePage(doc, pageId, name);
      if (!r.ok) return r;
      get().commit(r.value, { coalesceKey: `page-name:${pageId}` });
      return OK;
    },

    duplicatePage(pageId) {
      const doc = get().document;
      if (!doc) return OK;
      const r = ops.duplicatePage(doc, pageId);
      if (!r.ok) return r;
      get().commit(r.value.doc, { activePageId: r.value.pageId, select: null });
      return OK;
    },

    deletePage(pageId) {
      const doc = get().document;
      if (!doc) return OK;
      const r = ops.deletePage(doc, pageId);
      if (!r.ok) return r;
      const index = doc.pages.findIndex((p) => p.id === pageId);
      const neighbour = r.value.pages[Math.max(0, index - 1)]!;
      get().commit(r.value, { activePageId: get().activePageId === pageId ? neighbour.id : (get().activePageId ?? undefined), select: null });
      return OK;
    },

    movePage(pageId, delta) {
      const doc = get().document;
      if (doc) get().commit(ops.movePage(doc, pageId, delta));
    },

    markSaving(documentId) {
      if (get().document?.id !== documentId) return;
      set({ saveStatus: 'saving', saveError: null });
    },

    markSaved(documentId, version) {
      if (get().document?.id !== documentId) return;
      set({ saveStatus: 'saved', savedVersion: Math.max(version, get().savedVersion), persisted: true, saveError: null });
    },

    markSaveError(documentId, message) {
      if (get().document?.id !== documentId) return;
      set({ saveStatus: 'error', saveError: message });
    },
  };
});

/** Selectors */
export const selectActivePage = (s: EditorState) => s.document?.pages.find((p) => p.id === s.activePageId) ?? null;
export const selectSelectedComponent = (s: EditorState) => selectActivePage(s)?.components.find((c) => c.id === s.selectedId) ?? null;
export const selectIsDirty = (s: EditorState) => s.version !== s.savedVersion;
