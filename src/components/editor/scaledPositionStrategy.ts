import { createScaledStrategy } from 'react-grid-layout/core';

type PositionStrategy = ReturnType<typeof createScaledStrategy>;

/**
 * Position strategy for a grid inside a CSS-scaled container.
 *
 * react-grid-layout 2.3's `createScaledStrategy` computes the drag start
 * position from the item's *viewport* coordinates without subtracting the grid
 * container's position, so items jump by (container offset / scale) when a drag
 * starts. This version measures the container and subtracts it; positioning
 * and everything else are unchanged.
 */
export function createContainerScaledStrategy(scale: number, getContainerRect: () => DOMRect | undefined): PositionStrategy {
  const base = createScaledStrategy(scale);
  return {
    ...base,
    calcDragPosition(clientX: number, clientY: number, offsetX: number, offsetY: number) {
      const rect = getContainerRect();
      return {
        left: (clientX - offsetX - (rect?.left ?? 0)) / scale,
        top: (clientY - offsetY - (rect?.top ?? 0)) / scale,
      };
    },
  };
}
