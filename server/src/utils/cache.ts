import { currentTenant } from '../tenancy/context.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Every key is stored under the current institution, so a value cached for one college is never
 * returned to another (callers' keys only describe the query, not the institution).
 */
const scoped = (key: string) => `${currentTenant()?.code ?? '~platform'}::${key}`;

export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  get<T>(rawKey: string): T | null {
    const key = scoped(rawKey);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(rawKey: string, value: T, ttlSeconds = 60): void {
    const key = scoped(rawKey);
    if (this.cache.size >= this.maxEntries) {
      // Purge oldest key
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(rawPrefix: string): void {
    const prefix = scoped(rawPrefix);
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const appCache = new MemoryCache();
