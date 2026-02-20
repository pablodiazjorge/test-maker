import { afterEach, describe, expect, it, vi } from 'vitest';
import { THREE_DAYS_IN_MS, clearCacheValue, readCacheValue, writeCacheValue } from './browser-cache';

describe('browser-cache', () => {
  const cacheKey = 'spec.cache.key';

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('writes and reads values with default ttl', () => {
    writeCacheValue(cacheKey, { a: 1 });
    expect(readCacheValue<{ a: number }>(cacheKey)).toEqual({ a: 1 });
  });

  it('expires cached entries after ttl', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    writeCacheValue(cacheKey, 'value', 100);

    vi.spyOn(Date, 'now').mockReturnValue(1201);
    expect(readCacheValue<string>(cacheKey)).toBeNull();
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('removes invalid payloads when parsing fails', () => {
    localStorage.setItem(cacheKey, '{invalid');
    expect(readCacheValue(cacheKey)).toBeNull();
    expect(localStorage.getItem(cacheKey)).toBeNull();
  });

  it('clears entries explicitly', () => {
    writeCacheValue(cacheKey, 123, THREE_DAYS_IN_MS);
    clearCacheValue(cacheKey);
    expect(readCacheValue(cacheKey)).toBeNull();
  });
});
