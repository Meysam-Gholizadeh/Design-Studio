import { calcGridItemPosition, type PositionParams } from 'react-grid-layout/core';
import { CANVAS_PADDING, maxRowsForHeight } from '@/domain/grid';
import type { CanvasSettings, GridSettings } from '@/domain/schemas/document';
import type { ComponentLayout } from '@/domain/schemas/visuals';

/**
 * Grid → pixel parameters. Uses react-grid-layout's own math so the read-only
 * renderer and the editor grid place visuals at identical pixel positions.
 */
export function positionParamsFor(canvas: CanvasSettings, grid: GridSettings): PositionParams {
  return {
    margin: grid.margin,
    containerPadding: CANVAS_PADDING,
    containerWidth: canvas.width,
    cols: grid.columns,
    rowHeight: grid.rowHeight,
    maxRows: maxRowsForHeight(canvas.height, grid),
  };
}

export function pixelRect(params: PositionParams, layout: ComponentLayout) {
  return calcGridItemPosition(params, layout.x, layout.y, layout.w, layout.h);
}
