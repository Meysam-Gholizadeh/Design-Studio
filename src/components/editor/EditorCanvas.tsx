import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from 'react';
import ReactGridLayout from 'react-grid-layout';
import { calcGridColWidth, getCompactor } from 'react-grid-layout/core';
import { GridBackground } from 'react-grid-layout/extras';
import 'react-grid-layout/css/styles.css';
import { EyeOff, Lock, MousePointerClick } from 'lucide-react';
import { CANVAS_PADDING } from '@/domain/grid';
import type { Rect } from '@/domain/grid';
import { VISUAL_TYPES, type DashboardComponent, type VisualType } from '@/domain/schemas/visuals';
import { getVisualDefinition } from '@/domain/visualDefinitions';
import { DashboardRenderProvider } from '@/components/visuals/DashboardRenderContext';
import { VisualRenderer } from '@/components/visuals/VisualRenderer';
import { pixelRect, positionParamsFor } from '@/components/dashboard/pageGeometry';
import { toast } from '@/components/common/toastStore';
import { resolveTheme, themeToCssVars } from '@/services/themeService';
import { pageBackgroundImageStyle } from '@/components/dashboard/pageBackground';
import { previewPlacement, pageMaxRows } from '@/state/documentOps';
import { selectActivePage, useEditorStore } from '@/state/editorStore';
import { componentDisplayName } from './componentName';
import { LIBRARY_DRAG_MIME, libraryDrag } from './libraryDrag';
import { createContainerScaledStrategy } from './scaledPositionStrategy';
import styles from './EditorCanvas.module.css';

export type Zoom = 'fit' | number;

const compactor = getCompactor(null, false, true);
const RESIZE_HANDLES = ['se', 'e', 's', 'sw', 'w', 'ne', 'n', 'nw'] as const;

interface DropTarget {
  type: VisualType;
  /** Grid cell under the pointer (preferred position). */
  cell: { x: number; y: number };
  /** Where the visual will actually land, or null when the page is full. */
  rect: Rect | null;
}

/** One visual on the canvas: selection, focus and accessibility live here, rendering is shared. */
const CanvasItem = memo(function CanvasItem({ component, selected }: { component: DashboardComponent; selected: boolean }) {
  const select = useEditorStore((s) => s.select);
  const name = componentDisplayName(component);
  const label = getVisualDefinition(component.type).label;
  return (
    <div
      className={styles.itemInner}
      data-canvas-item={component.id}
      data-selected={selected || undefined}
      data-hidden={component.hidden || undefined}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={`${label}: ${name}${component.locked ? ' (locked)' : ''}${component.hidden ? ' (hidden)' : ''}`}
      onPointerDown={() => select(component.id)}
      onFocus={() => select(component.id)}
    >
      <div className={styles.visual}>
        <VisualRenderer component={component} />
      </div>
      {(component.hidden || component.locked) && (
        <div className={styles.badges} aria-hidden="true">
          {component.hidden && (
            <span className={styles.badge}>
              <EyeOff size={11} /> Hidden
            </span>
          )}
          {component.locked && (
            <span className={styles.badge}>
              <Lock size={11} /> Locked
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export function EditorCanvas({ zoom }: { zoom: Zoom }) {
  const document = useEditorStore((s) => s.document)!;
  const page = useEditorStore(selectActivePage)!;
  const selectedId = useEditorStore((s) => s.selectedId);
  const { select, applyLayouts, addVisual } = useEditorStore.getState();

  const workspaceRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [interacting, setInteracting] = useState(false);

  useLayoutEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const measure = () => setAvailable({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { canvas } = document;
  const scale = zoom === 'fit' ? Math.max(0.2, Math.min(1, (available.width - 64) / canvas.width)) : zoom;
  const params = useMemo(() => positionParamsFor(canvas, page.grid), [canvas, page.grid]);
  const maxRows = pageMaxRows(document, page);
  const theme = useMemo(() => resolveTheme(document.themeId, document.themeOverrides), [document.themeId, document.themeOverrides]);
  // Grid element captured with a callback ref; measured only when a drag starts.
  const [gridElement, setGridElement] = useState<HTMLDivElement | null>(null);
  const positionStrategy = useMemo(
    () => createContainerScaledStrategy(scale, () => gridElement?.getBoundingClientRect()),
    [scale, gridElement],
  );

  const layout = useMemo(
    () =>
      page.components.map((c) => ({
        i: c.id,
        x: c.layout.x,
        y: c.layout.y,
        w: c.layout.w,
        h: c.layout.h,
        minW: c.layout.minW,
        minH: c.layout.minH,
        maxW: c.layout.maxW,
        maxH: c.layout.maxH,
        isDraggable: !c.locked,
        isResizable: !c.locked && c.id === selectedId,
      })),
    [page.components, selectedId],
  );

  const children = useMemo(
    () =>
      page.components.map((c) => (
        <div key={c.id} className={styles.item}>
          <CanvasItem component={c} selected={c.id === selectedId} />
        </div>
      )),
    [page.components, selectedId],
  );

  /* ---------------- Library drop (native HTML5 drag & drop) ---------------- */

  const cellFromPointer = useCallback(
    (clientX: number, clientY: number, type: VisualType) => {
      const el = pageRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const px = (clientX - r.left) / scale;
      const py = (clientY - r.top) / scale;
      if (px < 0 || py < 0 || px > canvas.width || py > canvas.height) return null;
      const def = getVisualDefinition(type);
      const colW = calcGridColWidth(params);
      const wPx = def.defaultSize.w * colW + (def.defaultSize.w - 1) * page.grid.margin[0];
      const hPx = def.defaultSize.h * page.grid.rowHeight + (def.defaultSize.h - 1) * page.grid.margin[1];
      return {
        x: Math.max(0, Math.round((px - wPx / 2 - CANVAS_PADDING[0]) / (colW + page.grid.margin[0]))),
        y: Math.max(0, Math.round((py - hPx / 2 - CANVAS_PADDING[1]) / (page.grid.rowHeight + page.grid.margin[1]))),
      };
    },
    [scale, canvas.width, canvas.height, params, page.grid],
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    const type = libraryDrag.get();
    if (!type) return; // Not a library drag: let the browser refuse the drop.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const cell = cellFromPointer(e.clientX, e.clientY, type);
    if (!cell) return;
    if (dropTarget && dropTarget.type === type && dropTarget.cell.x === cell.x && dropTarget.cell.y === cell.y) return;
    setDropTarget({ type, cell, rect: previewPlacement(document, page.id, type, cell) });
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next || !pageRef.current?.contains(next)) setDropTarget(null);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const raw = libraryDrag.get() ?? e.dataTransfer.getData(LIBRARY_DRAG_MIME);
    libraryDrag.end();
    setDropTarget(null);
    if (!(VISUAL_TYPES as readonly string[]).includes(raw)) return;
    const type = raw as VisualType;
    const cell = cellFromPointer(e.clientX, e.clientY, type) ?? undefined;
    const r = addVisual(type, cell);
    if (!r.ok) toast.error(r.reason);
  };

  /* ---------------- Selection ---------------- */

  const onBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[data-canvas-item], .react-resizable-handle')) select(null);
  };

  const commitLayout = useCallback(
    (next: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
      setInteracting(false);
      applyLayouts(next.filter((it) => it.i !== '__dropping-elem__'));
    },
    [applyLayouts],
  );

  const pageStyle = {
    ...themeToCssVars(theme.tokens, canvas.background),
    ...pageBackgroundImageStyle(canvas),
    width: canvas.width,
    height: canvas.height,
    transform: `scale(${scale})`,
    // Editing chrome (outlines, handles, labels) divides by this to keep a constant on-screen size.
    '--canvas-scale': String(scale),
  } as CSSProperties;

  const dropRect = dropTarget?.rect ? pixelRect(params, dropTarget.rect) : null;

  return (
    <div ref={workspaceRef} className={styles.workspace} data-testid="editor-workspace">
      <div className={styles.pageFrame} style={{ width: canvas.width * scale, height: canvas.height * scale }}>
        <DashboardRenderProvider theme={theme} mode="edit">
          <div
            ref={pageRef}
            className={styles.page}
            style={pageStyle}
            data-testid="editor-canvas"
            data-theme-mode={theme.mode}
            data-interacting={interacting || undefined}
            aria-label={`Canvas: ${page.name}`}
            role="region"
            onPointerDown={onBackgroundPointerDown}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <GridBackground
              className={styles.gridBackground}
              width={canvas.width}
              cols={page.grid.columns}
              rowHeight={page.grid.rowHeight}
              margin={page.grid.margin}
              containerPadding={CANVAS_PADDING as [number, number]}
              rows={maxRows}
              color="rgba(127, 140, 160, 0.10)"
              borderRadius={3}
            />
            {available.width > 0 && (
              <ReactGridLayout
                width={canvas.width}
                layout={layout}
                gridConfig={{
                  cols: page.grid.columns,
                  rowHeight: page.grid.rowHeight,
                  margin: page.grid.margin,
                  containerPadding: CANVAS_PADDING,
                  maxRows,
                }}
                dragConfig={{ enabled: true, bounded: true, threshold: 4, cancel: '.react-resizable-handle' }}
                resizeConfig={{ enabled: true, handles: RESIZE_HANDLES }}
                compactor={compactor}
                positionStrategy={positionStrategy}
                innerRef={setGridElement}
                autoSize={false}
                style={{ height: canvas.height }}
                className={styles.grid}
                onDragStart={(_l, _o, item) => {
                  setInteracting(true);
                  if (item) select(item.i);
                }}
                onResizeStart={() => setInteracting(true)}
                onDragStop={(l) => commitLayout(l)}
                onResizeStop={(l) => commitLayout(l)}
              >
                {children}
              </ReactGridLayout>
            )}

            {dropTarget && (
              <div
                className={styles.dropPreview}
                data-full={!dropRect || undefined}
                style={dropRect ? { left: dropRect.left, top: dropRect.top, width: dropRect.width, height: dropRect.height } : undefined}
                data-testid="drop-preview"
              >
                <span className={styles.dropLabel}>{dropRect ? `Add ${getVisualDefinition(dropTarget.type).label}` : 'No free space on this page'}</span>
              </div>
            )}
          </div>
        </DashboardRenderProvider>
        {/* Rendered outside the scaled page so the hint stays readable at any zoom. */}
        {page.components.length === 0 && !dropTarget && (
          <div className={styles.empty}>
            <MousePointerClick size={32} strokeWidth={1.5} aria-hidden="true" />
            <p className={styles.emptyTitle}>Drag a visual onto the canvas</p>
            <p className={styles.emptyText}>or click any visual in the library to add it here</p>
          </div>
        )}
      </div>
    </div>
  );
}
