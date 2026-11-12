import { useEffect, useState } from 'react';
import type { PublishedItem } from '@/domain/schemas/published';
import { MANIFEST_URL, parseManifest } from './manifest';

export type PublishedState = { status: 'loading' } | { status: 'ready'; items: PublishedItem[] } | { status: 'error'; message: string };

/** Fetch the deployed gallery list. A missing list (404, or the SPA page instead of JSON) means "nothing published". */
export async function loadPublishedItems(fetchImpl: typeof fetch = fetch): Promise<PublishedItem[]> {
  const res = await fetchImpl(MANIFEST_URL, { cache: 'no-cache' });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`The list of Power BI files could not be loaded (${res.status}).`);
  if (!(res.headers.get('content-type') ?? '').includes('json')) return [];
  return parseManifest(await res.text()).items;
}

export function usePublishedItems(): PublishedState {
  const [state, setState] = useState<PublishedState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    loadPublishedItems()
      .then((items) => active && setState({ status: 'ready', items }))
      .catch((err: unknown) => active && setState({ status: 'error', message: err instanceof Error ? err.message : 'The list of Power BI files could not be loaded.' }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

/** Same matching idea as template search: every word must appear in the title, description, tags or file name. */
export function matchesPublished(item: PublishedItem, text: string, categoryId: string | null): boolean {
  if (categoryId && item.categoryId !== categoryId) return false;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [item.title, item.description, item.file.name, item.kind === 'pbix' ? 'power bi report pbix' : 'custom visual pbiviz', ...item.tags].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}
