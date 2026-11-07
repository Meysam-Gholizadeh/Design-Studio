import { useEffect, useRef, useState } from 'react';

/**
 * Marks an element as revealed once it scrolls into view (for entrance
 * animations). Without IntersectionObserver it is revealed immediately; the
 * CSS skips the animation when the user prefers reduced motion.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [revealed]);

  return { ref, revealed };
}
