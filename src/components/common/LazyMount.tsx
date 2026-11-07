import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazyMountProps {
  children: ReactNode;
  /** Rendered until the element scrolls near the viewport. */
  placeholder: ReactNode;
  rootMargin?: string;
}

/**
 * Mounts children only once they approach the viewport, then keeps them
 * mounted. Keeps galleries of chart-heavy thumbnails fast.
 */
export function LazyMount({ children, placeholder, rootMargin = '300px' }: LazyMountProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return <div ref={ref}>{visible ? children : placeholder}</div>;
}
