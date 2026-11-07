import { HomeHero } from '@/components/home/HomeHero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { ToolGrid } from '@/components/home/ToolGrid';
import { studioTools } from '@/components/home/tools';
import { THEMES } from '@/data/themes';
import { templateRepository } from '@/services/templateService';
import styles from './HomePage.module.css';

/**
 * Home: on a deep-blue backdrop with drifting aurora light, a hero with the
 * portal's name and purpose and a live, animated showcase of real templates;
 * a bento grid of every tool; and the three-step workflow. All motion stops
 * when the user prefers reduced motion.
 */
export function HomePage() {
  const templateCount = templateRepository.list().length;
  const tools = studioTools(templateCount);

  return (
    <div className={styles.backdrop}>
      <div className={styles.aurora} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.page}>
        <HomeHero templateCount={templateCount} themeCount={THEMES.length} categoryCount={templateRepository.listCategories().length} />

        <section className={styles.section} aria-labelledby="home-tools">
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>Everything in one studio</p>
            <h2 id="home-tools" className={styles.sectionTitle}>
              Pick a starting point
            </h2>
            <p className={styles.sectionText}>Every path leads to the same editor, the same renderer and the same exports.</p>
          </header>
          <ToolGrid tools={tools} />
        </section>

        <section className={styles.section} aria-labelledby="home-how">
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>How it works</p>
            <h2 id="home-how" className={styles.sectionTitle}>
              From idea to Power BI handoff
            </h2>
          </header>
          <HowItWorks />
        </section>

        <p className={styles.note}>Templates and AI drafts use fictional, illustrative sample data. Designs are saved in this browser only.</p>
      </div>
    </div>
  );
}
