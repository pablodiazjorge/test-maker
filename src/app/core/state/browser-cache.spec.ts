import { afterEach, describe, expect, it, vi } from 'vitest';
import { THREE_DAYS_IN_MS, clearCacheValue, purgeLegacyLocalCache, readCacheValue, writeCacheValue } from './browser-cache';

describe('browser-cache', () => {
  const cacheKey = 'spec.cache.key';

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('writes and reads values with default ttl', () => {
    writeCacheValue(cacheKey, { a: 1 });
    expect(readCacheValue<{ a: number }>(cacheKey)).toEqual({ a: 1 });
  });

  it('keeps values in sessionStorage, never in localStorage', () => {
    writeCacheValue(cacheKey, { a: 1 });
    expect(sessionStorage.getItem(cacheKey)).toContain('"a":1');
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('expires cached entries after ttl', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    writeCacheValue(cacheKey, 'value', 100);

    vi.spyOn(Date, 'now').mockReturnValue(1201);
    expect(readCacheValue<string>(cacheKey)).toBeNull();
    expect(sessionStorage.getItem(cacheKey)).toBeNull();
  });

  it('removes invalid payloads when parsing fails', () => {
    sessionStorage.setItem(cacheKey, '{invalid');
    expect(readCacheValue(cacheKey)).toBeNull();
    expect(sessionStorage.getItem(cacheKey)).toBeNull();
  });

  it('removes payloads without an expiry', () => {
    sessionStorage.setItem(cacheKey, JSON.stringify({ value: 1 }));
    expect(readCacheValue(cacheKey)).toBeNull();
    expect(sessionStorage.getItem(cacheKey)).toBeNull();
  });

  it('clears entries explicitly', () => {
    writeCacheValue(cacheKey, 123, THREE_DAYS_IN_MS);
    clearCacheValue(cacheKey);
    expect(readCacheValue(cacheKey)).toBeNull();
  });

  it('purges the cache entries that earlier versions left in localStorage', () => {
    localStorage.setItem('test-maker.auth.v1', '{}');
    localStorage.setItem('test-maker.master-data.alice.v1', '{}');
    localStorage.setItem('test-maker-theme', 'dark');
    localStorage.setItem('test-maker-language', 'es');
    localStorage.setItem('other-app', 'kept');

    purgeLegacyLocalCache();

    expect(localStorage.getItem('test-maker.auth.v1')).toBeNull();
    expect(localStorage.getItem('test-maker.master-data.alice.v1')).toBeNull();
    expect(localStorage.getItem('test-maker-theme')).toBe('dark');
    expect(localStorage.getItem('test-maker-language')).toBe('es');
    expect(localStorage.getItem('other-app')).toBe('kept');
  });
});
