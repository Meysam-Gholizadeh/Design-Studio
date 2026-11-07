/**
 * Persistence for user designs. The interface is storage-agnostic so a backend
 * API can replace IndexedDB later without touching the UI.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { DashboardDocument } from '@/domain/schemas/document';
import { validateDashboardDocument } from '@/domain/validation';

export interface DesignSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  themeId: string;
  pageCount: number;
  visualCount: number;
  categoryId?: string;
  sourceTemplateId?: string;
}

export interface DesignRepository {
  /** Most recently updated first. */
  list(): Promise<DesignSummary[]>;
  get(id: string): Promise<DashboardDocument | null>;
  save(document: DashboardDocument): Promise<void>;
  delete(id: string): Promise<void>;
}

export class DesignStorageError extends Error {
  override name = 'DesignStorageError';
}

export function summarizeDesign(doc: DashboardDocument): DesignSummary {
  return {
    id: doc.id,
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    themeId: doc.themeId,
    pageCount: doc.pages.length,
    visualCount: doc.pages.reduce((n, p) => n + p.components.length, 0),
    ...(doc.categoryId ? { categoryId: doc.categoryId } : {}),
    ...(doc.sourceTemplateId ? { sourceTemplateId: doc.sourceTemplateId } : {}),
  };
}

const DB_NAME = 'bi-design-studio';
const STORE = 'designs';

interface Schema {
  designs: { key: string; value: DashboardDocument };
}

class IndexedDbDesignRepository implements DesignRepository {
  private dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

  private db(): Promise<IDBPDatabase<Schema>> {
    if (!this.dbPromise) {
      if (typeof indexedDB === 'undefined') throw new DesignStorageError('This browser does not support local storage for designs.');
      this.dbPromise = openDB<Schema>(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        },
      }).catch((err: unknown) => {
        this.dbPromise = null;
        throw new DesignStorageError(`Couldn’t open browser storage (${err instanceof Error ? err.message : 'unknown error'}).`);
      });
    }
    return this.dbPromise;
  }

  async list(): Promise<DesignSummary[]> {
    const all = await (await this.db()).getAll(STORE);
    return all
      .filter((d) => validateDashboardDocument(d).ok)
      .map(summarizeDesign)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<DashboardDocument | null> {
    const raw = await (await this.db()).get(STORE, id);
    if (!raw) return null;
    // Stored data is re-validated: it may have been edited outside the app.
    const r = validateDashboardDocument(raw);
    if (!r.ok) throw new DesignStorageError(`This design is damaged and can’t be opened (${r.issues[0]?.message ?? 'invalid data'}).`);
    return r.value;
  }

  async save(document: DashboardDocument): Promise<void> {
    const r = validateDashboardDocument(document);
    if (!r.ok) throw new DesignStorageError(`Design could not be saved: ${r.issues[0]?.path} — ${r.issues[0]?.message}`);
    try {
      await (await this.db()).put(STORE, document);
    } catch (err) {
      const quota = err instanceof DOMException && err.name === 'QuotaExceededError';
      throw new DesignStorageError(quota ? 'Browser storage is full. Delete unused designs and try again.' : 'Couldn’t save to browser storage.');
    }
  }

  async delete(id: string): Promise<void> {
    await (await this.db()).delete(STORE, id);
  }
}

export const designRepository: DesignRepository = new IndexedDbDesignRepository();
