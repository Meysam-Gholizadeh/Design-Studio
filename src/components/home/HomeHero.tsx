import { Link } from 'react-router';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Showcase } from './Showcase';
import styles from './HomeHero.module.css';

interface HomeHeroProps {
  templateCount: number;
  themeCount: number;
  categoryCount: number;
}

/** Hero (on the page's deep-blue backdrop): name, purpose, calls to action, key numbers and the live template showcase. */
export function HomeHero({ templateCount, themeCount, categoryCount }: HomeHeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>
          <span className={styles.pulse} aria-hidden="true" />
          Dashboard design studio for Power BI teams
        </p>
        <h1 id="home-title" className={styles.title}>
          BI Design Studio
        </h1>
        <p className={styles.tagline}>Design dashboards people understand — before you build them in Power BI.</p>
        <div className={styles.actions}>
          <Link to="/gallery" className={styles.primary}>
            Browse templates <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link to="/editor/new" className={styles.secondary}>
            Start from blank
          </Link>
        </div>
        <Link to="/assistant" className={styles.aiLink}>
          <Sparkles size={15} aria-hidden="true" /> Or describe it to the AI Design Assistant
        </Link>
        <dl className={styles.stats}>
          <div>
            <dt>Templates</dt>
            <dd>{templateCount}</dd>
          </div>
          <div>
            <dt>Colour themes</dt>
            <dd>{themeCount}</dd>
          </div>
          <div>
            <dt>Business areas</dt>
            <dd>{categoryCount}</dd>
          </div>
          <div>
            <dt>Exports</dt>
            <dd>PBIP · HTML</dd>
          </div>
        </dl>
      </div>

      <div className={styles.visual}>
        <Showcase themeCount={themeCount} />
      </div>
    </section>
  );
}
