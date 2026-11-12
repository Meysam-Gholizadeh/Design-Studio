import type { CSSProperties } from 'react';
import type { CanvasSettings } from '@/domain/schemas/document';

/** The page background picture, stretched over the whole page behind the visuals (same in viewer, editor and exports). */
export function pageBackgroundImageStyle(canvas: CanvasSettings): CSSProperties {
  if (!canvas.backgroundImage) return {};
  // The source is a validated inline raster data URL (no quotes or parentheses can break out of url()).
  return { backgroundImage: `url("${canvas.backgroundImage}")`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' };
}
