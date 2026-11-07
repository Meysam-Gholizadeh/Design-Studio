import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { CHAT_DEFAULT_WIDTH, CHAT_MIN_WIDTH, chatMaxWidth, clampChatWidth } from './chatWidth';
import styles from './Assistant.module.css';

interface ResizeHandleProps {
  width: number;
  onResize: (width: number) => void;
  /** Called once a drag or key change ends (to persist the width). */
  onCommit: (width: number) => void;
  controls: string;
}

/**
 * Vertical splitter on the chat's right edge: drag with the pointer, or focus
 * it and use ←/→ (Shift for bigger steps), Home/End; double-click resets.
 */
export function ResizeHandle({ width, onResize, onCommit, controls }: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startWidth: number; last: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width, last: width };
    document.body.dataset.resizing = 'col';
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.last = clampChatWidth(d.startWidth + e.clientX - d.startX);
    onResize(d.last);
  };
  const end = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    delete document.body.dataset.resizing;
    onCommit(d.last);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 80 : 20;
    let next: number | null = null;
    if (e.key === 'ArrowLeft') next = width - step;
    else if (e.key === 'ArrowRight') next = width + step;
    else if (e.key === 'Home') next = CHAT_MIN_WIDTH;
    else if (e.key === 'End') next = chatMaxWidth();
    if (next === null) return;
    e.preventDefault();
    const w = clampChatWidth(next);
    onResize(w);
    onCommit(w);
  };
  const reset = () => {
    const w = clampChatWidth(CHAT_DEFAULT_WIDTH);
    onResize(w);
    onCommit(w);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize chat"
      aria-controls={controls}
      aria-valuenow={width}
      aria-valuemin={CHAT_MIN_WIDTH}
      aria-valuemax={chatMaxWidth()}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      className={styles.resizeHandle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
    />
  );
}
