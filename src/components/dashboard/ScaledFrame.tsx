import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ScaledFrame.module.css';

interface ScaledFrameProps {
  /** Design size of the content in pixels. */
  width: number;
  height: number;
  /** "width": scale to container width (height follows). "contain": fit inside the container box. */
  fit?: 'width' | 'contain';
  /** Never scale above this factor. */
  maxScale?: number;
  children: ReactNode;
  className?: string;
}

/**
 * Renders fixed-size content scaled with a CSS transform so it fits its
 * container. Layout inside stays at design size, so text, charts and grid
 * geometry are identical at every zoom level.
 */
export function ScaledFrame({ width, height, fit = 'width', maxScale = 1, children, className }: ScaledFrameProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw === 0) return;
      const s = fit === 'contain' && ch > 0 ? Math.min(cw / width, ch / height) : cw / width;
      setScale(Math.min(maxScale, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, fit, maxScale]);

  return (
    <div
      ref={outerRef}
      className={`${styles.outer} ${className ?? ''}`}
      data-fit={fit}
      style={fit === 'width' ? { height: scale !== null ? height * scale : undefined, aspectRatio: scale === null ? `${width} / ${height}` : undefined } : undefined}
    >
      {scale !== null && (
        <div className={styles.inner} style={{ width, height, transform: `scale(${scale})`, left: fit === 'contain' ? `calc(50% - ${(width * scale) / 2}px)` : 0 }}>
          {children}
        </div>
      )}
    </div>
  );
}
