import type { VisualType } from '@/domain/schemas/visuals';

/**
 * The visual type currently being dragged from the library. Browsers hide
 * dataTransfer contents during dragover, so the canvas reads it from here
 * to show an accurate drop preview.
 */
let current: VisualType | null = null;

export const LIBRARY_DRAG_MIME = 'application/x-bi-design-visual';

export const libraryDrag = {
  start(type: VisualType) {
    current = type;
  },
  end() {
    current = null;
  },
  get(): VisualType | null {
    return current;
  },
};
