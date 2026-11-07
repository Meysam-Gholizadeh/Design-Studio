import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { SearchInput } from '@/components/common/SearchInput';
import { CategoryFilter } from '@/components/gallery/CategoryFilter';
import { TemplateCard } from '@/components/gallery/TemplateCard';
import { templateRepository } from '@/services/templateService';
import page from './Page.module.css';
import styles from './GalleryPage.module.css';

export function GalleryPage() {
  const [params, setParams] = useSearchParams();
  const categories = templateRepository.listCategories();
  const rawCategory = params.get('category');
  const categoryId = rawCategory && templateRepository.getCategory(rawCategory) ? rawCategory : null;
  const text = params.get('q') ?? '';

  // Category counts reflect the current search text so users see where matches are.
  const textMatches = useMemo(() => templateRepository.search({ text }), [text]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of textMatches) c[s.template.categoryId] = (c[s.template.categoryId] ?? 0) + 1;
    return c;
  }, [textMatches]);
  const results = useMemo(() => textMatches.filter((s) => !categoryId || s.template.categoryId === categoryId), [textMatches, categoryId]);

  const update = (next: { category?: string | null; q?: string }) => {
    const p = new URLSearchParams(params);
    if (next.category !== undefined) {
      if (next.category) p.set('category', next.category);
      else p.delete('category');
    }
    if (next.q !== undefined) {
      if (next.q) p.set('q', next.q);
      else p.delete('q');
    }
    setParams(p, { replace: true });
  };

  const filtersActive = Boolean(categoryId || text);
  const activeCategory = categoryId ? templateRepository.getCategory(categoryId) : undefined;

  return (
    <div className={page.page}>
      <PageHeader
        title="Explore Dashboard Designs"
        description="Professional dashboard designs organized by business area. Every preview is a real dashboard you can open and customize."
        actions={<SampleDataNotice />}
      />

      <div className={styles.controls}>
        <SearchInput value={text} onChange={(q) => update({ q })} placeholder="Search by name, KPI or keyword…" label="Search templates" />
        <CategoryFilter categories={categories} counts={counts} total={textMatches.length} value={categoryId} onChange={(category) => update({ category })} />
      </div>

      <div className={styles.resultsBar}>
        <p className={styles.count} aria-live="polite">
          {results.length} {results.length === 1 ? 'design' : 'designs'}
          {activeCategory ? ` in ${activeCategory.name}` : ''}
          {text ? ` matching “${text}”` : ''}
        </p>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>

      {results.length > 0 ? (
        <div className={styles.grid}>
          {results.map((s) => (
            <TemplateCard key={s.template.id} summary={s} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<SearchX size={22} aria-hidden="true" />}
          title="No designs match your filters"
          description="Try a different keyword, or browse all categories."
          action={
            <Button variant="primary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  );
}
