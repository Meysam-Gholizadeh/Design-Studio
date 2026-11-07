import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Pause, Play, Share2, Sparkles, SwatchBook } from 'lucide-react';
import { DashboardPageView } from '@/components/dashboard/DashboardPageView';
import { ScaledFrame } from '@/components/dashboard/ScaledFrame';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { templateRepository } from '@/services/templateService';
import styles from './Showcase.module.css';

/** Templates shown in the hero, in order (missing ids are skipped). */
const FEATURED = ['fitness-overview', 'storefront-overview', 'personal-finance-hub', 'learning-platform-overview'];
const INTERVAL_MS = 5000;

/**
 * Hero showcase: real templates rendered by the same renderer as the gallery
 * and editor, cross-fading in a floating browser frame. Pauses on hover and
 * with the pause button, and never auto-advances with reduced motion.
 */
export function Showcase({ themeCount }: { themeCount: number }) {
  const items = FEATURED.map((id) => templateRepository.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const autoplay = !paused && !hovered && !reducedMotion && items.length > 1;

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % items.length), INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [autoplay, items.length]);

  if (items.length === 0) return null;
  const current = items[index]!;

  return (
    <figure
      className={styles.showcase}
      aria-label="Template showcase"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.stage}>
        <div className={styles.backCard} data-layer="2" aria-hidden="true" />
        <div className={styles.backCard} data-layer="1" aria-hidden="true" />
        <div className={styles.frame}>
          <div className={styles.chrome} aria-hidden="true">
            <span className={styles.lights}>
              <i />
              <i />
              <i />
            </span>
            <span className={styles.address}>bi-design-studio / gallery / {current.template.id}</span>
          </div>
          <div className={styles.screens}>
            {items.map((s, i) => (
              <div key={s.template.id} className={styles.screen} data-active={i === index || undefined} aria-hidden={i !== index}>
                <ScaledFrame width={s.template.document.canvas.width} height={s.template.document.canvas.height}>
                  <DashboardPageView document={s.template.document} mode="thumbnail" />
                </ScaledFrame>
              </div>
            ))}
          </div>
        </div>

        <span className={styles.chip} data-pos="top" aria-hidden="true">
          <Sparkles size={14} /> Draft with AI
        </span>
        <span className={styles.chip} data-pos="left" aria-hidden="true">
          <SwatchBook size={14} /> {themeCount} colour themes
        </span>
        <span className={styles.chip} data-pos="bottom" aria-hidden="true">
          <Share2 size={14} /> Export to Power BI
        </span>
      </div>

      <figcaption className={styles.caption}>
        <span className={styles.captionText} aria-live="polite">
          <span className={styles.captionName}>{current.template.name}</span>
          <span className={styles.captionCategory}>{current.category?.name}</span>
        </span>
        <span className={styles.controls}>
          {items.map((s, i) => (
            <button
              key={s.template.id}
              type="button"
              className={styles.dot}
              aria-label={`Show ${s.template.name}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
          {items.length > 1 && !reducedMotion && (
            <button type="button" className={styles.pause} onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play showcase' : 'Pause showcase'}>
              {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
            </button>
          )}
          <Link className={styles.open} to={`/gallery/${current.template.id}`}>
            View template <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </span>
      </figcaption>
    </figure>
  );
}
